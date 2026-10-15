package data

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/sha256"
	"crypto/x509"
	_ "embed"
	"encoding/asn1"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
	"strings"
	"time"

	"futcareer/backend/internal/payments/domain"
)

// Apple Root CA - G3, from https://www.apple.com/certificateauthority/
// (SHA-256 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79).
//
//go:embed certs/AppleRootCA-G3.pem
var appleRootG3 []byte

var (
	// Marker extensions Apple puts on the App Store signing chain.
	appleLeafOID         = asn1.ObjectIdentifier{1, 2, 840, 113635, 100, 6, 11, 1}
	appleIntermediateOID = asn1.ObjectIdentifier{1, 2, 840, 113635, 100, 6, 2, 1}
)

// AppStore verifies StoreKit 2 signed transactions and App Store Server
// Notifications V2 offline: the JWS chain must end at Apple's root and the
// bundle id must be this app's. Sandbox data is accepted because App Review
// buys in the sandbox against the production server.
type AppStore struct {
	bundleID string
	roots    *x509.CertPool
	now      func() time.Time
}

var _ domain.AppStoreVerifier = (*AppStore)(nil)

func NewAppStore(bundleID string) (*AppStore, error) {
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(appleRootG3) {
		return nil, errors.New("embedded Apple root certificate is invalid")
	}
	return newAppStore(bundleID, roots, time.Now)
}

func newAppStore(bundleID string, roots *x509.CertPool, now func() time.Time) (*AppStore, error) {
	bundleID = strings.TrimSpace(bundleID)
	if bundleID == "" || len(bundleID) > 155 {
		return nil, errors.New("APPLE_BUNDLE_ID must be the app's bundle identifier")
	}
	return &AppStore{bundleID: bundleID, roots: roots, now: now}, nil
}

type appleTransaction struct {
	TransactionID   string `json:"transactionId"`
	BundleID        string `json:"bundleId"`
	ProductID       string `json:"productId"`
	AppAccountToken string `json:"appAccountToken"`
	RevocationDate  int64  `json:"revocationDate"`
	Environment     string `json:"environment"`
}

func (a *AppStore) VerifyTransaction(signed string) (domain.StoreTransaction, error) {
	var payload appleTransaction
	if err := a.verify(signed, &payload); err != nil {
		return domain.StoreTransaction{}, domain.ErrInvalidPurchase
	}
	return a.transaction(payload)
}

func (a *AppStore) transaction(payload appleTransaction) (domain.StoreTransaction, error) {
	if payload.BundleID != a.bundleID || (payload.Environment != "Production" && payload.Environment != "Sandbox") ||
		payload.TransactionID == "" || len(payload.TransactionID) > 100 || payload.ProductID == "" {
		return domain.StoreTransaction{}, domain.ErrInvalidPurchase
	}
	state := "paid"
	if payload.RevocationDate > 0 {
		state = "refunded"
	}
	return domain.StoreTransaction{
		Store:         domain.StoreAppStore,
		TransactionID: payload.TransactionID,
		ProductID:     payload.ProductID,
		OrderID:       domain.OrderFromAccountToken(payload.AppAccountToken),
		State:         state,
	}, nil
}

type appleNotification struct {
	NotificationType string `json:"notificationType"`
	NotificationUUID string `json:"notificationUUID"`
	Data             struct {
		BundleID              string `json:"bundleId"`
		SignedTransactionInfo string `json:"signedTransactionInfo"`
	} `json:"data"`
}

// VerifyNotification returns a refund for REFUND and REVOKE notifications and
// nil for every other type.
func (a *AppStore) VerifyNotification(signed string) (*domain.StoreRefund, error) {
	var payload appleNotification
	if err := a.verify(signed, &payload); err != nil || payload.Data.BundleID != a.bundleID ||
		payload.NotificationUUID == "" || len(payload.NotificationUUID) > 100 {
		return nil, domain.ErrInvalidNotification
	}
	if payload.NotificationType != "REFUND" && payload.NotificationType != "REVOKE" {
		return nil, nil
	}
	transaction, err := a.VerifyTransaction(payload.Data.SignedTransactionInfo)
	if err != nil {
		return nil, domain.ErrInvalidNotification
	}
	return &domain.StoreRefund{
		Store:         domain.StoreAppStore,
		EventID:       "notification:" + payload.NotificationUUID,
		TransactionID: transaction.TransactionID,
		OrderID:       transaction.OrderID,
	}, nil
}

func (a *AppStore) verify(signed string, out any) error {
	parts := strings.Split(signed, ".")
	if len(parts) != 3 || len(signed) > 65536 {
		return errors.New("malformed JWS")
	}
	headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return err
	}
	var header struct {
		Alg string   `json:"alg"`
		X5C []string `json:"x5c"`
	}
	if err := json.Unmarshal(headerJSON, &header); err != nil {
		return err
	}
	if header.Alg != "ES256" || len(header.X5C) != 3 {
		return errors.New("unexpected JWS header")
	}
	certs := make([]*x509.Certificate, 2)
	for i := range certs {
		der, err := base64.StdEncoding.DecodeString(header.X5C[i])
		if err != nil {
			return err
		}
		if certs[i], err = x509.ParseCertificate(der); err != nil {
			return err
		}
	}
	leaf, intermediate := certs[0], certs[1]
	if !hasExtension(leaf, appleLeafOID) || !hasExtension(intermediate, appleIntermediateOID) {
		return errors.New("not an App Store signing chain")
	}
	intermediates := x509.NewCertPool()
	intermediates.AddCert(intermediate)
	if _, err := leaf.Verify(x509.VerifyOptions{Roots: a.roots, Intermediates: intermediates, CurrentTime: a.now(), KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageAny}}); err != nil {
		return err
	}
	key, ok := leaf.PublicKey.(*ecdsa.PublicKey)
	if !ok {
		return errors.New("unexpected signing key")
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || len(signature) != 64 {
		return errors.New("malformed signature")
	}
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if !ecdsa.Verify(key, digest[:], new(big.Int).SetBytes(signature[:32]), new(big.Int).SetBytes(signature[32:])) {
		return errors.New("signature mismatch")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return err
	}
	decoder := json.NewDecoder(bytes.NewReader(payload))
	return decoder.Decode(out)
}

func hasExtension(cert *x509.Certificate, oid asn1.ObjectIdentifier) bool {
	for _, extension := range cert.Extensions {
		if extension.Id.Equal(oid) {
			return true
		}
	}
	return false
}
