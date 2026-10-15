package data

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"time"

	"futcareer/backend/internal/payments/domain"
	"futcareer/backend/internal/platform/googleauth"
)

const (
	googlePublisherAPI   = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
	googlePublisherScope = "https://www.googleapis.com/auth/androidpublisher"
)

var googlePackagePattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$`)

// GooglePlay checks one-time product purchases with the Google Play Developer
// API using a service account that has the "View financial data" permission.
type GooglePlay struct {
	packageName string
	tokens      *googleauth.TokenSource
	apiBase     string
	client      *http.Client
}

var _ domain.GooglePlayVerifier = (*GooglePlay)(nil)

// NewGooglePlay reads the service account JSON file named by the operator.
func NewGooglePlay(packageName, serviceAccountFile string) (*GooglePlay, error) {
	raw, err := os.ReadFile(serviceAccountFile)
	if err != nil {
		return nil, fmt.Errorf("GOOGLE_PLAY_SERVICE_ACCOUNT_FILE could not be read: %w", err)
	}
	return newGooglePlay(packageName, raw, googlePublisherAPI, &http.Client{Timeout: 10 * time.Second}, time.Now)
}

func newGooglePlay(packageName string, raw []byte, apiBase string, client *http.Client, now func() time.Time) (*GooglePlay, error) {
	if !googlePackagePattern.MatchString(packageName) {
		return nil, errors.New("GOOGLE_PLAY_PACKAGE_NAME must be the Android application id")
	}
	account, err := googleauth.ParseAccount(raw)
	if err != nil {
		return nil, fmt.Errorf("Google Play %w", err)
	}
	return &GooglePlay{packageName: packageName, tokens: googleauth.NewTokenSource(account, googlePublisherScope, client, now), apiBase: apiBase, client: client}, nil
}

type productPurchase struct {
	PurchaseState               *int   `json:"purchaseState"`
	OrderID                     string `json:"orderId"`
	ObfuscatedExternalAccountID string `json:"obfuscatedExternalAccountId"`
}

func (g *GooglePlay) VerifyPurchase(ctx context.Context, productID, purchaseToken string) (domain.StoreTransaction, error) {
	if !domain.ValidStoreProducts(domain.StoreProducts{GoogleProductID: productID}) || productID == "" {
		return domain.StoreTransaction{}, domain.ErrInvalidPurchase
	}
	var purchase productPurchase
	path := g.packageName + "/purchases/products/" + url.PathEscape(productID) + "/tokens/" + url.PathEscape(purchaseToken)
	status, err := g.get(ctx, path, &purchase)
	if err != nil {
		return domain.StoreTransaction{}, err
	}
	if status == http.StatusNotFound || status == http.StatusBadRequest || status == http.StatusGone {
		return domain.StoreTransaction{}, domain.ErrInvalidPurchase
	}
	if status != http.StatusOK || purchase.PurchaseState == nil {
		return domain.StoreTransaction{}, fmt.Errorf("google play returned HTTP %d", status)
	}
	state := map[int]string{0: "paid", 1: "failed", 2: "pending"}[*purchase.PurchaseState]
	if state == "" {
		return domain.StoreTransaction{}, domain.ErrInvalidPurchase
	}
	return domain.StoreTransaction{
		Store:         domain.StoreGooglePlay,
		TransactionID: googlePaymentID(purchase.OrderID, purchaseToken),
		ProductID:     productID,
		OrderID:       domain.OrderFromAccountToken(purchase.ObfuscatedExternalAccountID),
		State:         state,
	}, nil
}

// googlePaymentID is Google's order id, or a stable token digest for test
// purchases that come without one.
func googlePaymentID(orderID, token string) string {
	if orderID != "" && len(orderID) <= 100 {
		return orderID
	}
	sum := sha256.Sum256([]byte(token))
	return "token-" + hex.EncodeToString(sum[:16])
}

type voidedPage struct {
	VoidedPurchases []struct {
		PurchaseToken    string `json:"purchaseToken"`
		OrderID          string `json:"orderId"`
		VoidedTimeMillis string `json:"voidedTimeMillis"`
	} `json:"voidedPurchases"`
	TokenPagination struct {
		NextPageToken string `json:"nextPageToken"`
	} `json:"tokenPagination"`
}

// VoidedSince lists refunded, charged-back and revoked purchases.
func (g *GooglePlay) VoidedSince(ctx context.Context, since time.Time) ([]domain.StoreRefund, time.Time, error) {
	refunds := []domain.StoreRefund{}
	latest := since
	pageToken := ""
	for page := 0; page < 50; page++ {
		query := url.Values{"startTime": {strconv.FormatInt(since.UnixMilli(), 10)}, "maxResults": {"1000"}}
		if pageToken != "" {
			query.Set("token", pageToken)
		}
		var result voidedPage
		status, err := g.get(ctx, g.packageName+"/purchases/voidedpurchases?"+query.Encode(), &result)
		if err != nil {
			return nil, since, err
		}
		if status != http.StatusOK {
			return nil, since, fmt.Errorf("google play returned HTTP %d", status)
		}
		for _, item := range result.VoidedPurchases {
			paymentID := googlePaymentID(item.OrderID, item.PurchaseToken)
			refunds = append(refunds, domain.StoreRefund{Store: domain.StoreGooglePlay, EventID: "voided:" + paymentID, TransactionID: paymentID})
			if millis, err := strconv.ParseInt(item.VoidedTimeMillis, 10, 64); err == nil {
				if at := time.UnixMilli(millis).UTC(); at.After(latest) {
					latest = at
				}
			}
		}
		pageToken = result.TokenPagination.NextPageToken
		if pageToken == "" {
			return refunds, latest, nil
		}
	}
	return refunds, latest, nil
}

func (g *GooglePlay) get(ctx context.Context, path string, out any) (int, error) {
	token, err := g.tokens.Token(ctx)
	if err != nil {
		return 0, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, g.apiBase+path, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	response, err := g.client.Do(req)
	if err != nil {
		return 0, err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 4<<20))
	if err != nil {
		return 0, err
	}
	if response.StatusCode == http.StatusOK {
		if err := json.Unmarshal(body, out); err != nil {
			return 0, err
		}
	}
	return response.StatusCode, nil
}
