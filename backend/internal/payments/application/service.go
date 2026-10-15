package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"regexp"
	"strings"
	"unicode/utf8"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/payments/domain"
)

var packageIDPattern = regexp.MustCompile(`^[a-f0-9]{32}$`)

type Service struct {
	repo    domain.Repository
	adapter CheckoutAdapter
	apple   domain.AppStoreVerifier
	google  domain.GooglePlayVerifier
}

func New(repo domain.Repository, adapters ...CheckoutAdapter) *Service {
	service := &Service{repo: repo}
	if len(adapters) > 0 {
		service.adapter = adapters[0]
	}
	return service
}

func newID() (string, error) {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}

func (s *Service) Packages(ctx context.Context, includeInactive bool) ([]domain.Package, error) {
	return s.repo.ListPackages(ctx, includeInactive)
}

func (s *Service) UpdatePackage(ctx context.Context, id string, amountMinor int64, active bool, products *domain.StoreProducts) (domain.Package, error) {
	if !packageIDPattern.MatchString(id) || amountMinor < 100 || amountMinor > 100000000 {
		return domain.Package{}, auth.ValidationError{"package": "Paket kimliği veya tutarı geçersiz. Tutar 1 TL ile 1.000.000 TL arasında olmalı."}
	}
	if products != nil && !domain.ValidStoreProducts(*products) {
		return domain.Package{}, storeProductError("package")
	}
	return s.repo.UpdatePackage(ctx, id, amountMinor, active, products)
}

func storeProductError(field string) auth.ValidationError {
	return auth.ValidationError{field: "Mağaza ürün kimliği en fazla 100 karakter olmalı; harf, rakam, nokta ve alt çizgi içerebilir (Google Play için küçük harf)."}
}

func (s *Service) ProPlan(ctx context.Context) (domain.ProPlan, error) {
	return s.repo.ProPlan(ctx)
}

func (s *Service) UpdateProPlan(ctx context.Context, id string, amountMinor int64, active bool, products *domain.StoreProducts) (domain.ProPlan, error) {
	if !packageIDPattern.MatchString(id) || amountMinor < 100 || amountMinor > 100000000 {
		return domain.ProPlan{}, auth.ValidationError{"plan": "Plan kimliği veya tutarı geçersiz. Tutar 1 TL ile 1.000.000 TL arasında olmalı."}
	}
	if products != nil && !domain.ValidStoreProducts(*products) {
		return domain.ProPlan{}, storeProductError("plan")
	}
	return s.repo.UpdateProPlan(ctx, id, amountMinor, active, products)
}

func (s *Service) Payments(ctx context.Context, query domain.Query) (domain.Page, error) {
	query.Search = strings.TrimSpace(query.Search)
	if query.Status == "" {
		query.Status = "all"
	}
	if query.Status != "all" && query.Status != "pending" && query.Status != "paid" && query.Status != "failed" && query.Status != "refunded" {
		return domain.Page{}, auth.ValidationError{"status": "Geçerli bir ödeme durumu seç."}
	}
	if query.Page < 1 || query.Page > 1000000 || query.PageSize < 1 || query.PageSize > 50 || utf8.RuneCountInString(query.Search) > 100 {
		return domain.Page{}, auth.ValidationError{"pagination": "Sayfa 1–1000000, sayfa boyutu 1–50 ve arama en fazla 100 karakter olmalı."}
	}
	return s.repo.ListPayments(ctx, query)
}

func (s *Service) ApplyEvent(ctx context.Context, event domain.ProviderEvent) error {
	if len(event.EventID) < 1 || len(event.EventID) > 200 ||
		!packageIDPattern.MatchString(event.OrderID) ||
		len(event.Provider) < 1 || len(event.Provider) > 80 ||
		len(event.ProviderPaymentID) < 1 || len(event.ProviderPaymentID) > 200 ||
		(event.Status != "paid" && event.Status != "failed" && event.Status != "refunded") {
		return domain.ErrInvalidEvent
	}
	return s.repo.ApplyEvent(ctx, event)
}

func (s *Service) CreateOrder(ctx context.Context, playerID, packageID string) (domain.CheckoutResult, error) {
	if s.adapter == nil {
		return domain.CheckoutResult{}, domain.ErrProviderUnavailable
	}
	return s.createCheckout(ctx, playerID, packageID, domain.ProductTeamRights)
}

// CreateProOrder starts a Pro checkout; Pro becomes active only after the signed paid webhook.
func (s *Service) CreateProOrder(ctx context.Context, userID, planID string) (domain.CheckoutResult, error) {
	if s.adapter == nil {
		return domain.CheckoutResult{}, domain.ErrProviderUnavailable
	}
	return s.createCheckout(ctx, userID, planID, domain.ProductPro)
}
