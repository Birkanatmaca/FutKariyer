package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound            = errors.New("payment package not found")
	ErrForbidden           = errors.New("payment access not allowed")
	ErrPackageUnavailable  = errors.New("payment package unavailable")
	ErrProviderUnavailable = errors.New("payment checkout provider unavailable")
	ErrInvalidEvent        = errors.New("invalid payment event")
	ErrDuplicateProduct    = errors.New("store product id already used")
)

type Package struct {
	ID          string `json:"id"`
	Credits     int    `json:"credits"`
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
	Active      bool   `json:"active"`
	SortOrder   int    `json:"sortOrder"`
	StoreProducts
}

// Products sold through the provider-independent checkout and the app stores.
const (
	ProductTeamRights = "team_rights"
	ProductPro        = "pro"
)

// ProPlan is the single Pro membership offer: Days of Pro and BonusCredits team rights per paid period.
type ProPlan struct {
	ID           string `json:"id"`
	Days         int    `json:"days"`
	BonusCredits int    `json:"bonusCredits"`
	AmountMinor  int64  `json:"amountMinor"`
	Currency     string `json:"currency"`
	Active       bool   `json:"active"`
	StoreProducts
}

type Payment struct {
	ID                string     `json:"id"`
	Product           string     `json:"product"`
	PlayerID          string     `json:"playerId,omitempty"`
	PlayerName        string     `json:"playerName"`
	PlayerEmail       string     `json:"playerEmail"`
	PackageID         string     `json:"packageId,omitempty"`
	PackageCredits    int        `json:"packageCredits"`
	AmountMinor       int64      `json:"amountMinor"`
	Currency          string     `json:"currency"`
	Provider          string     `json:"provider"`
	ProviderPaymentID string     `json:"providerPaymentId,omitempty"`
	Status            string     `json:"status"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
	ConfirmedAt       *time.Time `json:"confirmedAt,omitempty"`
}

type Order struct {
	ID             string
	Product        string
	PlayerID       string
	PackageID      string
	PackageCredits int
	AmountMinor    int64
	Currency       string
	Status         string
}

type CheckoutResult struct {
	OrderID           string `json:"orderId"`
	Status            string `json:"status"`
	Provider          string `json:"provider"`
	ProviderPaymentID string `json:"providerPaymentId"`
	CheckoutURL       string `json:"checkoutUrl"`
}

type ProviderEvent struct {
	EventID           string `json:"eventId"`
	OrderID           string `json:"orderId"`
	Provider          string `json:"provider"`
	ProviderPaymentID string `json:"providerPaymentId"`
	Status            string `json:"status"`
}

type Query struct {
	Status   string
	Search   string
	Page     int
	PageSize int
}

type Summary struct {
	Total          int   `json:"total"`
	Pending        int   `json:"pending"`
	Paid           int   `json:"paid"`
	Failed         int   `json:"failed"`
	Refunded       int   `json:"refunded"`
	CollectedMinor int64 `json:"collectedMinor"`
	RefundedMinor  int64 `json:"refundedMinor"`
}

type Page struct {
	Items      []Payment `json:"items"`
	Page       int       `json:"page"`
	PageSize   int       `json:"pageSize"`
	Total      int       `json:"total"`
	TotalPages int       `json:"totalPages"`
	Summary    Summary   `json:"summary"`
}

type Repository interface {
	ListPackages(context.Context, bool) ([]Package, error)
	UpdatePackage(context.Context, string, int64, bool, *StoreProducts) (Package, error)
	ListPayments(context.Context, Query) (Page, error)
	CreateOrder(context.Context, string, string, string) (Order, error)
	ProPlan(context.Context) (ProPlan, error)
	UpdateProPlan(context.Context, string, int64, bool, *StoreProducts) (ProPlan, error)
	CreateProOrder(context.Context, string, string, string) (Order, error)
	SetCheckout(context.Context, string, string, string) error
	MarkOrderFailed(context.Context, string) error
	ApplyEvent(context.Context, ProviderEvent) error
	// Store purchases.
	SetOrderProvider(ctx context.Context, orderID, provider string) error
	StoreOrder(ctx context.Context, orderID string) (StoreOrderInfo, error)
	OrderByProviderPayment(ctx context.Context, provider, paymentID string) (string, error)
	SyncCursor(ctx context.Context, name string) (time.Time, bool, error)
	SetSyncCursor(ctx context.Context, name string, position time.Time) error
}
