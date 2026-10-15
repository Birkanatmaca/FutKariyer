package data

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/asn1"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
	"strings"
	"testing"
	"time"

	"futcareer/backend/internal/payments/domain"
)

type signingChain struct {
	roots *x509.CertPool
	x5c   []string
	key   *ecdsa.PrivateKey
}

func newChain(t *testing.T, markers bool) signingChain {
	t.Helper()
	now := time.Now()
	issue := func(serial int64, subject string, parent *x509.Certificate, parentKey *ecdsa.PrivateKey, ca bool, oid asn1.ObjectIdentifier) (*x509.Certificate, *ecdsa.PrivateKey) {
		key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			t.Fatal(err)
		}
		template := &x509.Certificate{
			SerialNumber: big.NewInt(serial), Subject: pkix.Name{CommonName: subject},
			NotBefore: now.Add(-time.Hour), NotAfter: now.Add(time.Hour),
			IsCA: ca, BasicConstraintsValid: true,
			KeyUsage: x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		}
		if oid != nil && markers {
			template.ExtraExtensions = []pkix.Extension{{Id: oid, Value: []byte{5, 0}}}
		}
		if parent == nil {
			parent, parentKey = template, key
		}
		der, err := x509.CreateCertificate(rand.Reader, template, parent, &key.PublicKey, parentKey)
		if err != nil {
			t.Fatal(err)
		}
		cert, err := x509.ParseCertificate(der)
		if err != nil {
			t.Fatal(err)
		}
		return cert, key
	}
	root, rootKey := issue(1, "Test Root", nil, nil, true, nil)
	intermediate, intermediateKey := issue(2, "Test WWDR", root, rootKey, true, appleIntermediateOID)
	leaf, leafKey := issue(3, "Test Signing", intermediate, intermediateKey, false, appleLeafOID)
	roots := x509.NewCertPool()
	roots.AddCert(root)
	encode := func(cert *x509.Certificate) string { return base64.StdEncoding.EncodeToString(cert.Raw) }
	return signingChain{roots: roots, x5c: []string{encode(leaf), encode(intermediate), encode(root)}, key: leafKey}
}

func (c signingChain) sign(t *testing.T, payload any) string {
	t.Helper()
	header, _ := json.Marshal(map[string]any{"alg": "ES256", "x5c": c.x5c})
	body, _ := json.Marshal(payload)
	unsigned := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(body)
	digest := sha256.Sum256([]byte(unsigned))
	r, s, err := ecdsa.Sign(rand.Reader, c.key, digest[:])
	if err != nil {
		t.Fatal(err)
	}
	signature := make([]byte, 64)
	r.FillBytes(signature[:32])
	s.FillBytes(signature[32:])
	return unsigned + "." + base64.RawURLEncoding.EncodeToString(signature)
}

const testOrder = "0123456789abcdef0123456789abcdef"

func transactionPayload() map[string]any {
	return map[string]any{
		"transactionId": "2000000123", "bundleId": "com.futcareer.app", "productId": "com.futcareer.rights.2",
		"appAccountToken": domain.AccountToken(testOrder), "environment": "Sandbox", "type": "Consumable",
	}
}

func TestEmbeddedAppleRootLoads(t *testing.T) {
	if _, err := NewAppStore("com.futcareer.app"); err != nil {
		t.Fatal(err)
	}
}

func TestAppStoreTransactionVerification(t *testing.T) {
	chain := newChain(t, true)
	store, err := newAppStore("com.futcareer.app", chain.roots, time.Now)
	if err != nil {
		t.Fatal(err)
	}
	got, err := store.VerifyTransaction(chain.sign(t, transactionPayload()))
	if err != nil {
		t.Fatal(err)
	}
	want := domain.StoreTransaction{Store: domain.StoreAppStore, TransactionID: "2000000123", ProductID: "com.futcareer.rights.2", OrderID: testOrder, State: "paid"}
	if got != want {
		t.Fatalf("got %+v want %+v", got, want)
	}

	revoked := transactionPayload()
	revoked["revocationDate"] = time.Now().UnixMilli()
	if got, err := store.VerifyTransaction(chain.sign(t, revoked)); err != nil || got.State != "refunded" {
		t.Fatalf("revoked transaction: %+v %v", got, err)
	}

	otherApp := transactionPayload()
	otherApp["bundleId"] = "com.example.other"
	if _, err := store.VerifyTransaction(chain.sign(t, otherApp)); !errors.Is(err, domain.ErrInvalidPurchase) {
		t.Fatalf("another app's transaction was accepted: %v", err)
	}

	signed := chain.sign(t, transactionPayload())
	parts := strings.Split(signed, ".")
	tampered := transactionPayload()
	tampered["productId"] = "com.futcareer.rights.10"
	body, _ := json.Marshal(tampered)
	forged := parts[0] + "." + base64.RawURLEncoding.EncodeToString(body) + "." + parts[2]
	if _, err := store.VerifyTransaction(forged); !errors.Is(err, domain.ErrInvalidPurchase) {
		t.Fatalf("tampered payload was accepted: %v", err)
	}
}

func TestAppStoreRejectsForeignChains(t *testing.T) {
	trusted := newChain(t, true)
	store, _ := newAppStore("com.futcareer.app", trusted.roots, time.Now)
	if _, err := store.VerifyTransaction(newChain(t, true).sign(t, transactionPayload())); err == nil {
		t.Fatal("a chain from another root was accepted")
	}
	unmarked := newChain(t, false)
	store, _ = newAppStore("com.futcareer.app", unmarked.roots, time.Now)
	if _, err := store.VerifyTransaction(unmarked.sign(t, transactionPayload())); err == nil {
		t.Fatal("a chain without App Store markers was accepted")
	}
}

func TestAppStoreNotifications(t *testing.T) {
	chain := newChain(t, true)
	store, _ := newAppStore("com.futcareer.app", chain.roots, time.Now)
	notification := func(kind string) string {
		return chain.sign(t, map[string]any{
			"notificationType": kind, "notificationUUID": "b1f0c7d2-uuid",
			"data": map[string]any{"bundleId": "com.futcareer.app", "signedTransactionInfo": chain.sign(t, transactionPayload())},
		})
	}
	refund, err := store.VerifyNotification(notification("REFUND"))
	if err != nil || refund == nil {
		t.Fatalf("refund: %+v %v", refund, err)
	}
	if refund.TransactionID != "2000000123" || refund.OrderID != testOrder || refund.EventID != "notification:b1f0c7d2-uuid" {
		t.Fatalf("unexpected refund %+v", refund)
	}
	if refund, err := store.VerifyNotification(notification("CONSUMPTION_REQUEST")); err != nil || refund != nil {
		t.Fatalf("other notifications must be acknowledged without action: %+v %v", refund, err)
	}
	if _, err := store.VerifyNotification("not.a.jws"); !errors.Is(err, domain.ErrInvalidNotification) {
		t.Fatalf("garbage notification: %v", err)
	}
}
