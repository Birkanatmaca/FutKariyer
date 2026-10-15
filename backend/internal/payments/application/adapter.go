package application

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"futcareer/backend/internal/payments/domain"
)

type CheckoutRequest struct {
	OrderID        string `json:"orderId"`
	Product        string `json:"product"`
	Credits        int    `json:"credits"`
	AmountMinor    int64  `json:"amountMinor"`
	Currency       string `json:"currency"`
	IdempotencyKey string `json:"idempotencyKey"`
}

type CheckoutSession struct {
	Provider          string `json:"provider"`
	ProviderPaymentID string `json:"providerPaymentId"`
	CheckoutURL       string `json:"checkoutUrl"`
}

type CheckoutAdapter interface {
	CreateCheckout(context.Context, CheckoutRequest) (CheckoutSession, error)
}

type HTTPAdapter struct {
	endpoint string
	secret   []byte
	client   *http.Client
}

func NewHTTPAdapter(endpoint, secret string) (*HTTPAdapter, error) {
	parsed, err := url.Parse(strings.TrimSpace(endpoint))
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return nil, errors.New("PAYMENT_ADAPTER_URL must be a trusted HTTPS endpoint")
	}
	if len(secret) < 32 {
		return nil, errors.New("PAYMENT_ADAPTER_SECRET must contain at least 32 bytes")
	}
	return &HTTPAdapter{endpoint: parsed.String(), secret: []byte(secret), client: &http.Client{Timeout: 10 * time.Second}}, nil
}

func SignPayload(secret, body []byte) string {
	hash := hmac.New(sha256.New, secret)
	_, _ = hash.Write(body)
	return hex.EncodeToString(hash.Sum(nil))
}

func (a *HTTPAdapter) CreateCheckout(ctx context.Context, input CheckoutRequest) (CheckoutSession, error) {
	body, err := json.Marshal(input)
	if err != nil {
		return CheckoutSession{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.endpoint, bytes.NewReader(body))
	if err != nil {
		return CheckoutSession{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-FutCareer-Signature", SignPayload(a.secret, body))
	response, err := a.client.Do(req)
	if err != nil {
		return CheckoutSession{}, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return CheckoutSession{}, fmt.Errorf("payment adapter returned HTTP %d", response.StatusCode)
	}
	decoder := json.NewDecoder(io.LimitReader(response.Body, 8193))
	decoder.DisallowUnknownFields()
	var result CheckoutSession
	if err := decoder.Decode(&result); err != nil {
		return CheckoutSession{}, err
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return CheckoutSession{}, errors.New("payment adapter returned an invalid response")
	}
	return result, nil
}

func (s *Service) CheckoutEnabled() bool { return s.adapter != nil }

func (s *Service) createCheckout(ctx context.Context, playerID, packageID, product string) (domain.CheckoutResult, error) {
	if s.adapter == nil {
		return domain.CheckoutResult{}, domain.ErrProviderUnavailable
	}
	if !packageIDPattern.MatchString(packageID) {
		return domain.CheckoutResult{}, domain.ErrPackageUnavailable
	}
	orderID, err := newID()
	if err != nil {
		return domain.CheckoutResult{}, err
	}
	var order domain.Order
	if product == domain.ProductPro {
		order, err = s.repo.CreateProOrder(ctx, playerID, packageID, orderID)
	} else {
		order, err = s.repo.CreateOrder(ctx, playerID, packageID, orderID)
	}
	if err != nil {
		return domain.CheckoutResult{}, err
	}
	checkout, err := s.adapter.CreateCheckout(ctx, CheckoutRequest{
		OrderID:        order.ID,
		Product:        order.Product,
		Credits:        order.PackageCredits,
		AmountMinor:    order.AmountMinor,
		Currency:       order.Currency,
		IdempotencyKey: order.ID,
	})
	if err != nil {
		_ = s.repo.MarkOrderFailed(ctx, order.ID)
		return domain.CheckoutResult{}, domain.ErrProviderUnavailable
	}
	parsed, parseErr := url.Parse(checkout.CheckoutURL)
	if parseErr != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || len(checkout.Provider) < 1 || len(checkout.Provider) > 80 || len(checkout.ProviderPaymentID) < 1 || len(checkout.ProviderPaymentID) > 200 {
		_ = s.repo.MarkOrderFailed(ctx, order.ID)
		return domain.CheckoutResult{}, domain.ErrProviderUnavailable
	}
	if err := s.repo.SetCheckout(ctx, order.ID, checkout.Provider, checkout.ProviderPaymentID); err != nil {
		return domain.CheckoutResult{}, err
	}
	return domain.CheckoutResult{OrderID: order.ID, Status: "pending", Provider: checkout.Provider, ProviderPaymentID: checkout.ProviderPaymentID, CheckoutURL: parsed.String()}, nil
}
