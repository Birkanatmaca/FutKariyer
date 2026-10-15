package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"futcareer/backend/internal/payments/domain"
)

const (
	packageID = "00000000000000000000000000000002"
	planID    = "000000000000000000000000000a0030"
)

// fakeRepo keeps orders in memory; unused Repository methods panic via the nil embed.
type fakeRepo struct {
	domain.Repository
	orders map[string]*domain.StoreOrderInfo
	events []domain.ProviderEvent
	byPay  map[string]string
	cursor time.Time
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{orders: map[string]*domain.StoreOrderInfo{}, byPay: map[string]string{}}
}

func (f *fakeRepo) ListPackages(context.Context, bool) ([]domain.Package, error) {
	return []domain.Package{{ID: packageID, Credits: 2, Active: true, StoreProducts: domain.StoreProducts{AppleProductID: "com.futcareer.rights.2"}}}, nil
}
func (f *fakeRepo) ProPlan(context.Context) (domain.ProPlan, error) {
	return domain.ProPlan{ID: planID, Active: true, StoreProducts: domain.StoreProducts{AppleProductID: "com.futcareer.pro.30days", GoogleProductID: "com.futcareer.pro.30days"}}, nil
}
func (f *fakeRepo) CreateOrder(_ context.Context, _, _, orderID string) (domain.Order, error) {
	f.orders[orderID] = &domain.StoreOrderInfo{ID: orderID, Status: "pending", ProductID: "com.futcareer.rights.2"}
	return domain.Order{ID: orderID}, nil
}
func (f *fakeRepo) CreateProOrder(_ context.Context, _, _, orderID string) (domain.Order, error) {
	f.orders[orderID] = &domain.StoreOrderInfo{ID: orderID, Status: "pending", ProductID: "com.futcareer.pro.30days"}
	return domain.Order{ID: orderID}, nil
}
func (f *fakeRepo) SetOrderProvider(_ context.Context, orderID, provider string) error {
	f.orders[orderID].Provider = provider
	return nil
}
func (f *fakeRepo) StoreOrder(_ context.Context, orderID string) (domain.StoreOrderInfo, error) {
	order, ok := f.orders[orderID]
	if !ok {
		return domain.StoreOrderInfo{}, domain.ErrNotFound
	}
	return *order, nil
}
func (f *fakeRepo) ApplyEvent(_ context.Context, event domain.ProviderEvent) error {
	order := f.orders[event.OrderID]
	if event.Status == "refunded" && order.Status != "paid" && order.Status != "refunded" {
		return domain.ErrInvalidEvent
	}
	if event.Status != "failed" || order.Status == "pending" {
		order.Status = event.Status
	}
	f.events = append(f.events, event)
	f.byPay[event.ProviderPaymentID] = event.OrderID
	return nil
}
func (f *fakeRepo) OrderByProviderPayment(_ context.Context, _, paymentID string) (string, error) {
	if id, ok := f.byPay[paymentID]; ok {
		return id, nil
	}
	return "", domain.ErrNotFound
}
func (f *fakeRepo) SyncCursor(context.Context, string) (time.Time, bool, error) {
	return f.cursor, !f.cursor.IsZero(), nil
}
func (f *fakeRepo) SetSyncCursor(_ context.Context, _ string, at time.Time) error {
	f.cursor = at
	return nil
}

type fakeApple struct {
	transaction domain.StoreTransaction
	refund      *domain.StoreRefund
}

func (a *fakeApple) VerifyTransaction(string) (domain.StoreTransaction, error) {
	return a.transaction, nil
}
func (a *fakeApple) VerifyNotification(string) (*domain.StoreRefund, error) { return a.refund, nil }

type fakeGoogle struct {
	transaction domain.StoreTransaction
	voided      []domain.StoreRefund
	since       time.Time
}

func (g *fakeGoogle) VerifyPurchase(context.Context, string, string) (domain.StoreTransaction, error) {
	return g.transaction, nil
}
func (g *fakeGoogle) VoidedSince(_ context.Context, since time.Time) ([]domain.StoreRefund, time.Time, error) {
	g.since = since
	return g.voided, since.Add(time.Hour), nil
}

func TestStoreOrderNeedsAConfiguredStoreProduct(t *testing.T) {
	repo := newFakeRepo()
	service := New(repo)
	ctx := context.Background()
	if _, err := service.CreateStoreOrder(ctx, "user", domain.StoreAppStore, domain.ProductTeamRights, packageID); !errors.Is(err, domain.ErrStoreUnavailable) {
		t.Fatalf("an unconfigured store accepted an order: %v", err)
	}
	service.WithStores(&fakeApple{}, &fakeGoogle{})
	// The package has no Google Play product id.
	if _, err := service.CreateStoreOrder(ctx, "user", domain.StoreGooglePlay, domain.ProductTeamRights, packageID); !errors.Is(err, domain.ErrPackageUnavailable) {
		t.Fatalf("a package without a store product was sold: %v", err)
	}
	order, err := service.CreateStoreOrder(ctx, "user", domain.StoreAppStore, domain.ProductTeamRights, packageID)
	if err != nil {
		t.Fatal(err)
	}
	if order.ProductID != "com.futcareer.rights.2" || order.AccountToken != domain.AccountToken(order.OrderID) || repo.orders[order.OrderID].Provider != domain.StoreAppStore {
		t.Fatalf("unexpected order %+v", order)
	}
}

func TestConfirmStorePurchaseMatchesItsOrder(t *testing.T) {
	repo := newFakeRepo()
	apple := &fakeApple{}
	service := New(repo).WithStores(apple, &fakeGoogle{})
	ctx := context.Background()
	order, err := service.CreateStoreOrder(ctx, "user", domain.StoreAppStore, domain.ProductTeamRights, packageID)
	if err != nil {
		t.Fatal(err)
	}
	apple.transaction = domain.StoreTransaction{Store: domain.StoreAppStore, TransactionID: "200", ProductID: "com.futcareer.rights.10", OrderID: order.OrderID, State: "paid"}
	if _, err := service.ConfirmStorePurchase(ctx, domain.StoreAppStore, "", "jws"); !errors.Is(err, domain.ErrPurchaseMismatch) {
		t.Fatalf("a different product paid for the order: %v", err)
	}
	apple.transaction.ProductID, apple.transaction.OrderID = "com.futcareer.rights.2", "ffffffffffffffffffffffffffffffff"
	if _, err := service.ConfirmStorePurchase(ctx, domain.StoreAppStore, "", "jws"); !errors.Is(err, domain.ErrPurchaseMismatch) {
		t.Fatalf("an unknown order was accepted: %v", err)
	}
	apple.transaction.OrderID = order.OrderID
	for range 2 { // a resent purchase is harmless
		result, err := service.ConfirmStorePurchase(ctx, domain.StoreAppStore, "", "jws")
		if err != nil || result != (domain.StorePurchaseResult{OrderID: order.OrderID, Status: "paid", Finish: true}) {
			t.Fatalf("confirm: %+v %v", result, err)
		}
	}
	if got := repo.events[0]; got.EventID != "purchase:200" || got.ProviderPaymentID != "200" || got.Provider != domain.StoreAppStore {
		t.Fatalf("unexpected event %+v", got)
	}
}

func TestPendingAndCancelledGooglePurchases(t *testing.T) {
	repo := newFakeRepo()
	google := &fakeGoogle{}
	service := New(repo).WithStores(nil, google)
	ctx := context.Background()
	order, err := service.CreateStoreOrder(ctx, "user", domain.StoreGooglePlay, domain.ProductPro, planID)
	if err != nil {
		t.Fatal(err)
	}
	google.transaction = domain.StoreTransaction{Store: domain.StoreGooglePlay, TransactionID: "GPA.1", ProductID: "com.futcareer.pro.30days", OrderID: order.OrderID, State: "pending"}
	result, err := service.ConfirmStorePurchase(ctx, domain.StoreGooglePlay, "com.futcareer.pro.30days", "token")
	if err != nil || result.Finish || result.Status != "pending" || len(repo.events) != 0 {
		t.Fatalf("a pending purchase must not be finished or applied: %+v %v", result, err)
	}
	google.transaction.State = "failed"
	result, err = service.ConfirmStorePurchase(ctx, domain.StoreGooglePlay, "com.futcareer.pro.30days", "token")
	if err != nil || !result.Finish || result.Status != "failed" {
		t.Fatalf("a cancelled purchase must close the order: %+v %v", result, err)
	}
}

func TestStoreRefunds(t *testing.T) {
	repo := newFakeRepo()
	apple := &fakeApple{}
	google := &fakeGoogle{}
	service := New(repo).WithStores(apple, google)
	ctx := context.Background()
	order, _ := service.CreateStoreOrder(ctx, "user", domain.StoreAppStore, domain.ProductTeamRights, packageID)
	apple.transaction = domain.StoreTransaction{Store: domain.StoreAppStore, TransactionID: "300", ProductID: "com.futcareer.rights.2", OrderID: order.OrderID, State: "paid"}
	if _, err := service.ConfirmStorePurchase(ctx, domain.StoreAppStore, "", "jws"); err != nil {
		t.Fatal(err)
	}
	apple.refund = &domain.StoreRefund{Store: domain.StoreAppStore, EventID: "notification:1", TransactionID: "300", OrderID: order.OrderID}
	if err := service.HandleAppStoreNotification(ctx, "payload"); err != nil || repo.orders[order.OrderID].Status != "refunded" {
		t.Fatalf("refund was not applied: %v %+v", err, repo.orders[order.OrderID])
	}
	// Unknown or never-confirmed purchases are ignored rather than failing the sync.
	now := time.Date(2026, 10, 15, 0, 0, 0, 0, time.UTC)
	google.voided = []domain.StoreRefund{{Store: domain.StoreGooglePlay, EventID: "voided:x", TransactionID: "GPA.unknown"}}
	if err := service.SyncGoogleRefunds(ctx, now); err != nil {
		t.Fatal(err)
	}
	if !google.since.Equal(now.Add(-30*24*time.Hour)) || !repo.cursor.Equal(google.since.Add(time.Hour)) {
		t.Fatalf("cursor handling: since=%v cursor=%v", google.since, repo.cursor)
	}
}

func TestAccountTokenRoundTrip(t *testing.T) {
	token := domain.AccountToken(packageID)
	if token != "00000000-0000-0000-0000-000000000002" || domain.OrderFromAccountToken(token) != packageID || domain.OrderFromAccountToken(packageID) != packageID {
		t.Fatalf("token %q", token)
	}
	if domain.OrderFromAccountToken("0000-0000") != "" || domain.OrderFromAccountToken("00000000-0000-0000-0000-00000000000Z") != "" {
		t.Fatal("malformed tokens must not map to an order")
	}
}
