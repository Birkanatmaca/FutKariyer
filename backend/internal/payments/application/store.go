package application

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"futcareer/backend/internal/payments/domain"
)

const googleVoidedCursor = "google_play_voided"

// WithStores enables App Store and/or Google Play purchases; a nil verifier
// leaves that store unavailable.
func (s *Service) WithStores(apple domain.AppStoreVerifier, google domain.GooglePlayVerifier) *Service {
	s.apple, s.google = apple, google
	return s
}

func (s *Service) Stores() domain.StoreAvailability {
	return domain.StoreAvailability{AppStore: s.apple != nil, GooglePlay: s.google != nil}
}

// CreateStoreOrder records a pending order before the app opens the store
// sheet. Credits or Pro are granted only after ConfirmStorePurchase verifies
// the store's own record of the payment.
func (s *Service) CreateStoreOrder(ctx context.Context, userID, store, product, itemID string) (domain.StoreOrder, error) {
	if !s.Stores().Has(store) {
		return domain.StoreOrder{}, domain.ErrStoreUnavailable
	}
	if !packageIDPattern.MatchString(itemID) {
		return domain.StoreOrder{}, domain.ErrPackageUnavailable
	}
	productID, err := s.storeProduct(ctx, store, product, itemID)
	if err != nil {
		return domain.StoreOrder{}, err
	}
	orderID, err := newID()
	if err != nil {
		return domain.StoreOrder{}, err
	}
	if product == domain.ProductPro {
		_, err = s.repo.CreateProOrder(ctx, userID, itemID, orderID)
	} else {
		_, err = s.repo.CreateOrder(ctx, userID, itemID, orderID)
	}
	if err != nil {
		return domain.StoreOrder{}, err
	}
	if err := s.repo.SetOrderProvider(ctx, orderID, store); err != nil {
		return domain.StoreOrder{}, err
	}
	return domain.StoreOrder{OrderID: orderID, Store: store, ProductID: productID, AccountToken: domain.AccountToken(orderID)}, nil
}

func (s *Service) storeProduct(ctx context.Context, store, product, itemID string) (string, error) {
	switch product {
	case domain.ProductTeamRights:
		packages, err := s.repo.ListPackages(ctx, false)
		if err != nil {
			return "", err
		}
		for _, item := range packages {
			if item.ID == itemID && item.Active && item.For(store) != "" {
				return item.For(store), nil
			}
		}
	case domain.ProductPro:
		plan, err := s.repo.ProPlan(ctx)
		if err != nil && !errors.Is(err, domain.ErrNotFound) {
			return "", err
		}
		if err == nil && plan.ID == itemID && plan.Active && plan.For(store) != "" {
			return plan.For(store), nil
		}
	}
	return "", domain.ErrPackageUnavailable
}

// ConfirmStorePurchase verifies a store purchase and applies it to the order
// named by its account token. It is idempotent: the app may resend the same
// purchase (for example after a crash) until it is told to finish it.
func (s *Service) ConfirmStorePurchase(ctx context.Context, store, productID, token string) (domain.StorePurchaseResult, error) {
	if !s.Stores().Has(store) {
		return domain.StorePurchaseResult{}, domain.ErrStoreUnavailable
	}
	if len(token) < 1 || len(token) > 32768 {
		return domain.StorePurchaseResult{}, domain.ErrInvalidPurchase
	}
	var transaction domain.StoreTransaction
	var err error
	if store == domain.StoreAppStore {
		transaction, err = s.apple.VerifyTransaction(token)
	} else {
		transaction, err = s.google.VerifyPurchase(ctx, productID, token)
	}
	if err != nil {
		return domain.StorePurchaseResult{}, err
	}
	if transaction.OrderID == "" || transaction.Store != store {
		return domain.StorePurchaseResult{}, domain.ErrPurchaseMismatch
	}
	order, err := s.repo.StoreOrder(ctx, transaction.OrderID)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.StorePurchaseResult{}, domain.ErrPurchaseMismatch
	}
	if err != nil {
		return domain.StorePurchaseResult{}, err
	}
	if order.Provider != store || order.ProductID == "" || order.ProductID != transaction.ProductID {
		return domain.StorePurchaseResult{}, domain.ErrPurchaseMismatch
	}
	switch transaction.State {
	case "pending":
		// Deferred payments (e.g. parental approval) arrive again when settled.
		return domain.StorePurchaseResult{OrderID: order.ID, Status: "pending"}, nil
	case "paid", "refunded":
		event := domain.ProviderEvent{EventID: "purchase:" + transaction.TransactionID, OrderID: order.ID, Provider: store, ProviderPaymentID: transaction.TransactionID, Status: "paid"}
		if err := s.ApplyEvent(ctx, event); err != nil {
			return domain.StorePurchaseResult{}, err
		}
		if transaction.State == "refunded" {
			event.EventID, event.Status = "revoked:"+transaction.TransactionID, "refunded"
			if err := s.ApplyEvent(ctx, event); err != nil {
				return domain.StorePurchaseResult{}, err
			}
		}
	case "failed":
		// A cancelled store purchase closes the order; a paid order is untouched.
		event := domain.ProviderEvent{EventID: "failed:" + transaction.TransactionID, OrderID: order.ID, Provider: store, ProviderPaymentID: transaction.TransactionID, Status: "failed"}
		if err := s.ApplyEvent(ctx, event); err != nil {
			return domain.StorePurchaseResult{}, err
		}
	default:
		return domain.StorePurchaseResult{}, domain.ErrInvalidPurchase
	}
	order, err = s.repo.StoreOrder(ctx, order.ID)
	if err != nil {
		return domain.StorePurchaseResult{}, err
	}
	return domain.StorePurchaseResult{OrderID: order.ID, Status: order.Status, Finish: order.Status != "pending"}, nil
}

// HandleAppStoreNotification applies refunds and revocations from App Store
// Server Notifications V2; other notification types are acknowledged.
func (s *Service) HandleAppStoreNotification(ctx context.Context, signedPayload string) error {
	if s.apple == nil {
		return domain.ErrStoreUnavailable
	}
	refund, err := s.apple.VerifyNotification(signedPayload)
	if err != nil || refund == nil {
		return err
	}
	return s.applyRefund(ctx, *refund)
}

// SyncGoogleRefunds reads Google Play's voided purchases since the stored cursor.
func (s *Service) SyncGoogleRefunds(ctx context.Context, now time.Time) error {
	if s.google == nil {
		return domain.ErrStoreUnavailable
	}
	since, ok, err := s.repo.SyncCursor(ctx, googleVoidedCursor)
	if err != nil {
		return err
	}
	// Google keeps voided purchases for 30 days.
	if oldest := now.Add(-30 * 24 * time.Hour); !ok || since.Before(oldest) {
		since = oldest
	}
	refunds, next, err := s.google.VoidedSince(ctx, since)
	if err != nil {
		return err
	}
	for _, refund := range refunds {
		if err := s.applyRefund(ctx, refund); err != nil {
			return err
		}
	}
	if next.After(since) {
		return s.repo.SetSyncCursor(ctx, googleVoidedCursor, next)
	}
	return nil
}

// RunGoogleRefundSync polls voided purchases until ctx ends.
func (s *Service) RunGoogleRefundSync(ctx context.Context, every time.Duration) {
	if s.google == nil {
		return
	}
	ticker := time.NewTicker(every)
	defer ticker.Stop()
	for {
		if err := s.SyncGoogleRefunds(ctx, time.Now().UTC()); err != nil && ctx.Err() == nil {
			slog.ErrorContext(ctx, "payment.refund_sync.failed", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *Service) applyRefund(ctx context.Context, refund domain.StoreRefund) error {
	orderID := refund.OrderID
	if orderID == "" {
		id, err := s.repo.OrderByProviderPayment(ctx, refund.Store, refund.TransactionID)
		if errors.Is(err, domain.ErrNotFound) {
			return nil // not a Fut Career purchase or never confirmed
		}
		if err != nil {
			return err
		}
		orderID = id
	}
	err := s.ApplyEvent(ctx, domain.ProviderEvent{EventID: refund.EventID, OrderID: orderID, Provider: refund.Store, ProviderPaymentID: refund.TransactionID, Status: "refunded"})
	if errors.Is(err, domain.ErrNotFound) || errors.Is(err, domain.ErrInvalidEvent) {
		// An order that was never confirmed as paid has nothing to take back.
		slog.WarnContext(ctx, "payment.refund.ignored", "store", refund.Store, "order", orderID, "error", err)
		return nil
	}
	return err
}
