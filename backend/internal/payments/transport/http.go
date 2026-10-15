package transport

import (
	"bytes"
	"crypto/hmac"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/payments/application"
	"futcareer/backend/internal/payments/domain"
	prodomain "futcareer/backend/internal/pro/domain"
)

type Handler struct {
	auth          *auth.Service
	service       *application.Service
	webhookSecret []byte
}

func NewPublic(authService *auth.Service, service *application.Service, webhookSecret string) http.Handler {
	h := &Handler{auth: authService, service: service, webhookSecret: []byte(webhookSecret)}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/payments/packages", h.packages)
	mux.HandleFunc("POST /v1/me/team-request-payments", h.createOrder)
	mux.HandleFunc("GET /v1/payments/pro-plan", h.proPlan)
	mux.HandleFunc("POST /v1/me/pro-payments", h.createProOrder)
	mux.HandleFunc("POST /v1/payments/webhook", h.webhook)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		mux.ServeHTTP(w, r)
	})
}

func NewAdmin(service *application.Service) http.Handler {
	h := &Handler{service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/admin/payments", h.listPayments)
	mux.HandleFunc("GET /v1/admin/payments/packages", h.listAdminPackages)
	mux.HandleFunc("PUT /v1/admin/payments/packages/{id}", h.updatePackage)
	mux.HandleFunc("GET /v1/admin/payments/pro-plan", h.adminProPlan)
	mux.HandleFunc("PUT /v1/admin/payments/pro-plan/{id}", h.updateProPlan)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		mux.ServeHTTP(w, r)
	})
}

func write(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func failure(w http.ResponseWriter, err error) {
	status, code, message := 500, "internal_error", "Ödeme bilgileri yüklenemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrForbidden):
		status, code, message = 403, "forbidden", "Bu alan hesabına açık değil."
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "not_found", "Ödeme paketi bulunamadı."
	case errors.Is(err, domain.ErrPackageUnavailable):
		status, code, message = 404, "package_unavailable", "Bu paket artık satışta değil."
	case errors.Is(err, domain.ErrProviderUnavailable):
		status, code, message = 503, "payment_unavailable", "Güvenli ödeme bağlantısı şu anda kullanılamıyor."
	case errors.Is(err, domain.ErrInvalidEvent):
		status, code, message = 422, "invalid_payment_event", "Ödeme bildirimi doğrulanamadı."
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", fields.Error()
	default:
		slog.Error("payment operation failed", "error", err)
	}
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}

// accountID authenticates a mobile account that may hold Pro (player, club or coach).
func (h *Handler) accountID(w http.ResponseWriter, r *http.Request) (string, bool) {
	parts := strings.Fields(r.Header.Get("Authorization"))
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		failure(w, authdomain.ErrUnauthorized)
		return "", false
	}
	user, err := h.auth.Me(r.Context(), parts[1])
	if err != nil {
		failure(w, err)
		return "", false
	}
	if !prodomain.EligibleRole(user.Role) {
		failure(w, domain.ErrForbidden)
		return "", false
	}
	return user.ID, true
}

func (h *Handler) proPlan(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.accountID(w, r); !ok {
		return
	}
	plan, err := h.service.ProPlan(r.Context())
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"plan": plan, "checkoutEnabled": h.service.CheckoutEnabled()})
}

func (h *Handler) createProOrder(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.accountID(w, r)
	if !ok {
		return
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	var input struct {
		PlanID string `json:"planId"`
	}
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") || decoder.Decode(&input) != nil || decoder.Decode(&struct{}{}) != io.EOF {
		failure(w, auth.ValidationError{"planId": "Geçerli bir Pro plan seç."})
		return
	}
	order, err := h.service.CreateProOrder(r.Context(), userID, input.PlanID)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, order)
}

func (h *Handler) adminProPlan(w http.ResponseWriter, r *http.Request) {
	plan, err := h.service.ProPlan(r.Context())
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"plan": plan})
}

func (h *Handler) updateProPlan(w http.ResponseWriter, r *http.Request) {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	var input struct {
		AmountMinor *int64 `json:"amountMinor"`
		Active      *bool  `json:"active"`
	}
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") || decoder.Decode(&input) != nil || decoder.Decode(&struct{}{}) != io.EOF || input.AmountMinor == nil || input.Active == nil {
		failure(w, auth.ValidationError{"plan": "Fiyat ve satış durumu birlikte gönderilmeli."})
		return
	}
	plan, err := h.service.UpdateProPlan(r.Context(), r.PathValue("id"), *input.AmountMinor, *input.Active)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"plan": plan})
}

func (h *Handler) playerID(w http.ResponseWriter, r *http.Request) (string, bool) {
	parts := strings.Fields(r.Header.Get("Authorization"))
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		failure(w, authdomain.ErrUnauthorized)
		return "", false
	}
	user, err := h.auth.Me(r.Context(), parts[1])
	if err != nil {
		failure(w, err)
		return "", false
	}
	if user.Role != "player" {
		failure(w, domain.ErrForbidden)
		return "", false
	}
	return user.ID, true
}

func (h *Handler) packages(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.playerID(w, r); !ok {
		return
	}
	items, err := h.service.Packages(r.Context(), false)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"items": items, "checkoutEnabled": h.service.CheckoutEnabled()})
}

func (h *Handler) createOrder(w http.ResponseWriter, r *http.Request) {
	playerID, ok := h.playerID(w, r)
	if !ok {
		return
	}
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		failure(w, auth.ValidationError{"packageId": "JSON biçiminde paket seçimi gerekli."})
		return
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	var input struct {
		PackageID string `json:"packageId"`
	}
	if err := decoder.Decode(&input); err != nil {
		failure(w, auth.ValidationError{"packageId": "Geçerli bir paket seç."})
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		failure(w, auth.ValidationError{"packageId": "Tek bir paket gönder."})
		return
	}
	order, err := h.service.CreateOrder(r.Context(), playerID, input.PackageID)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, order)
}

func (h *Handler) webhook(w http.ResponseWriter, r *http.Request) {
	if len(h.webhookSecret) < 32 {
		failure(w, domain.ErrProviderUnavailable)
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 8192))
	if err != nil {
		failure(w, domain.ErrInvalidEvent)
		return
	}
	signature, err := hex.DecodeString(r.Header.Get("X-FutCareer-Signature"))
	if err != nil || !hmac.Equal(signature, mustSignature(h.webhookSecret, body)) {
		failure(w, domain.ErrForbidden)
		return
	}
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	var event domain.ProviderEvent
	if err := decoder.Decode(&event); err != nil {
		failure(w, domain.ErrInvalidEvent)
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		failure(w, domain.ErrInvalidEvent)
		return
	}
	if err := h.service.ApplyEvent(r.Context(), event); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func mustSignature(secret, body []byte) []byte {
	value, _ := hex.DecodeString(application.SignPayload(secret, body))
	return value
}

func (h *Handler) listAdminPackages(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.Packages(r.Context(), true)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"items": items})
}

func pageNumber(r *http.Request, key string, fallback int) int {
	values, ok := r.URL.Query()[key]
	if !ok {
		return fallback
	}
	if len(values) != 1 {
		return 0
	}
	value, err := strconv.Atoi(values[0])
	if err != nil {
		return 0
	}
	return value
}

func (h *Handler) listPayments(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	page, err := h.service.Payments(r.Context(), domain.Query{
		Status:   query.Get("status"),
		Search:   query.Get("search"),
		Page:     pageNumber(r, "page", 1),
		PageSize: pageNumber(r, "pageSize", 20),
	})
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, page)
}

func (h *Handler) updatePackage(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		failure(w, auth.ValidationError{"package": "JSON biçiminde paket bilgisi gerekli."})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	var input struct {
		AmountMinor *int64 `json:"amountMinor"`
		Active      *bool  `json:"active"`
	}
	if err := decoder.Decode(&input); err != nil {
		failure(w, auth.ValidationError{"package": "Geçerli paket bilgisi gönder."})
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		failure(w, auth.ValidationError{"package": "Tek bir paket gönder."})
		return
	}
	if input.AmountMinor == nil || input.Active == nil {
		failure(w, auth.ValidationError{"package": "Fiyat ve satış durumu birlikte gönderilmeli."})
		return
	}
	item, err := h.service.UpdatePackage(r.Context(), r.PathValue("id"), *input.AmountMinor, *input.Active)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"package": item})
}
