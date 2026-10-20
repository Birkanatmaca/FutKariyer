package transport

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/gifts/application"
	"futcareer/backend/internal/gifts/domain"
	"futcareer/backend/internal/platform/logging"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
}

// NewPlayer serves the account-side inbox: list gifts and claim one.
func NewPlayer(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{auth: authService, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/gifts", h.inbox)
	mux.HandleFunc("POST /v1/gifts/{id}/claim", h.claim)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		mux.ServeHTTP(w, r)
	})
}

// NewAdmin serves campaign management. It is mounted behind the admin session check.
func NewAdmin(service *application.Service) http.Handler {
	h := &Handler{service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/admin/gifts", h.adminList)
	mux.HandleFunc("POST /v1/admin/gifts", h.adminCreate)
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
	status, code, message := 500, "internal_error", "Hediyeler yüklenemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrForbidden):
		status, code, message = 403, "forbidden", "Bu hesap hediyeleri kullanamıyor."
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "not_found", "Hediye bulunamadı. Listeyi yenile."
	case errors.Is(err, domain.ErrExpired):
		status, code, message = 409, "gift_expired", "Bu hediyenin geçerlilik süresi dolmuş."
	case errors.Is(err, domain.ErrNoRecipient):
		status, code, message = 422, "no_recipient", "Hediye gönderilecek aktif hesap bulunamadı."
	case errors.Is(err, domain.ErrKindRole):
		status, code, message = 422, "kind_role", "Bu hediye bu hesap türüne verilemez."
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", fields.Error()
	default:
		logging.Fail(w, "gift.failed", err)
	}
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}

func (h *Handler) actor(w http.ResponseWriter, r *http.Request) (string, bool) {
	parts := strings.Fields(r.Header.Get("Authorization"))
	token := ""
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		token = parts[1]
	}
	u, err := h.auth.Me(r.Context(), token)
	if err != nil {
		failure(w, err)
		return "", false
	}
	if u.Role != "player" && u.Role != "club" && u.Role != "coach" {
		failure(w, domain.ErrForbidden)
		return "", false
	}
	return u.ID, true
}

func (h *Handler) inbox(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	inbox, err := h.service.Mine(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, inbox)
}

func (h *Handler) claim(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1))
	if err != nil || len(data) > 0 {
		failure(w, auth.ValidationError{"gift": "Hediye alma isteği gövdesi boş olmalı."})
		return
	}
	inbox, outcome, err := h.service.Claim(r.Context(), id, r.PathValue("id"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"result": outcome, "items": inbox.Items, "availableCount": inbox.AvailableCount, "serverTime": inbox.ServerTime})
}

func (h *Handler) adminList(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.List(r.Context())
	if err != nil {
		failure(w, err)
		return
	}
	out := make([]map[string]any, 0, len(items))
	for _, g := range items {
		out = append(out, map[string]any{
			"id": g.ID, "kind": g.Kind, "title": g.Title, "message": g.Message,
			"audience": g.Audience, "targetEmail": nullableString(g.TargetEmail),
			"validityDays": g.ValidityDays, "createdAt": g.CreatedAt,
			"recipients": g.Recipients, "claimed": g.Claimed,
		})
	}
	write(w, 200, map[string]any{"items": out})
}

func (h *Handler) adminCreate(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		failure(w, auth.ValidationError{"gift": "JSON biçiminde hediye gönder."})
		return
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	var input application.CreateInput
	if err := decoder.Decode(&input); err != nil || decoder.Decode(&struct{}{}) != io.EOF {
		failure(w, auth.ValidationError{"gift": "Geçerli bir hediye gönder."})
		return
	}
	gift, err := h.service.Create(r.Context(), input)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, map[string]any{"id": gift.ID, "kind": gift.Kind, "title": gift.Title, "recipients": gift.Recipients, "validityDays": gift.ValidityDays})
}

func nullableString(v string) any {
	if v == "" {
		return nil
	}
	return v
}
