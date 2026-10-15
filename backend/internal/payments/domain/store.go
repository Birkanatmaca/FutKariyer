package domain

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// In-app purchase stores. The store id is also the order's provider.
const (
	StoreAppStore   = "app_store"
	StoreGooglePlay = "google_play"
)

var (
	ErrStoreUnavailable    = errors.New("store purchases are not configured")
	ErrInvalidPurchase     = errors.New("store purchase could not be verified")
	ErrPurchaseMismatch    = errors.New("store purchase does not match its order")
	ErrInvalidNotification = errors.New("store notification could not be verified")

	appleProductPattern  = regexp.MustCompile(`^[A-Za-z0-9._]{1,100}$`)
	googleProductPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9._]{0,99}$`)
	orderIDPattern       = regexp.MustCompile(`^[a-f0-9]{32}$`)
)

// StoreProducts maps one sellable item to its product id in each store; an
// empty id means the item is not sold in that store.
type StoreProducts struct {
	AppleProductID  string `json:"appleProductId"`
	GoogleProductID string `json:"googleProductId"`
}

func (p StoreProducts) For(store string) string {
	switch store {
	case StoreAppStore:
		return p.AppleProductID
	case StoreGooglePlay:
		return p.GoogleProductID
	}
	return ""
}

// ValidStoreProducts checks admin input; empty ids are allowed.
func ValidStoreProducts(p StoreProducts) bool {
	return (p.AppleProductID == "" || appleProductPattern.MatchString(p.AppleProductID)) &&
		(p.GoogleProductID == "" || googleProductPattern.MatchString(p.GoogleProductID))
}

// StoreAvailability tells the app which stores the server can verify.
type StoreAvailability struct {
	AppStore   bool `json:"appStore"`
	GooglePlay bool `json:"googlePlay"`
}

func (a StoreAvailability) Has(store string) bool {
	return (store == StoreAppStore && a.AppStore) || (store == StoreGooglePlay && a.GooglePlay)
}

// StoreOrder is returned before the app opens the store sheet. AccountToken
// ties the store transaction to this order: Apple's appAccountToken (a UUID)
// and Google's obfuscated account id both carry it.
type StoreOrder struct {
	OrderID      string `json:"orderId"`
	Store        string `json:"store"`
	ProductID    string `json:"productId"`
	AccountToken string `json:"accountToken"`
}

// StoreOrderInfo is what the server needs to match a verified purchase.
type StoreOrderInfo struct {
	ID        string
	Provider  string
	Status    string
	ProductID string // product id of the order's item in its store
}

// StoreTransaction is a purchase as reported by the store after verification.
type StoreTransaction struct {
	Store         string
	TransactionID string // provider payment id: Apple transactionId, Google orderId
	ProductID     string
	OrderID       string // recovered from the account token
	State         string // "paid", "pending" or "refunded"
}

// StorePurchaseResult is returned to the app; finish tells it whether the
// store transaction may be finished (consumed) now.
type StorePurchaseResult struct {
	OrderID string `json:"orderId"`
	Status  string `json:"status"`
	Finish  bool   `json:"finish"`
}

// StoreRefund is a refund or revocation reported by a store.
type StoreRefund struct {
	Store         string
	EventID       string
	TransactionID string
	OrderID       string // may be empty; looked up by TransactionID then
}

// AppStoreVerifier checks signed App Store data locally against Apple's root.
type AppStoreVerifier interface {
	VerifyTransaction(signedTransaction string) (StoreTransaction, error)
	VerifyNotification(signedPayload string) (*StoreRefund, error)
}

// GooglePlayVerifier asks the Google Play Developer API about purchases.
type GooglePlayVerifier interface {
	VerifyPurchase(ctx context.Context, productID, purchaseToken string) (StoreTransaction, error)
	VoidedSince(ctx context.Context, since time.Time) ([]StoreRefund, time.Time, error)
}

// AccountToken formats an order id as the UUID string Apple requires.
func AccountToken(orderID string) string {
	if !orderIDPattern.MatchString(orderID) {
		return ""
	}
	return fmt.Sprintf("%s-%s-%s-%s-%s", orderID[0:8], orderID[8:12], orderID[12:16], orderID[16:20], orderID[20:32])
}

// OrderFromAccountToken accepts Apple's UUID form or the plain order id.
func OrderFromAccountToken(token string) string {
	id := strings.ToLower(strings.ReplaceAll(token, "-", ""))
	if !orderIDPattern.MatchString(id) {
		return ""
	}
	if strings.Contains(token, "-") && AccountToken(id) != strings.ToLower(token) {
		return ""
	}
	return id
}
