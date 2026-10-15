package transport

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/listings/application"
	"futcareer/backend/internal/listings/domain"
	teamdomain "futcareer/backend/internal/teams/domain"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
}

func New(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{auth: authService, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/listings", h.open)
	mux.HandleFunc("GET /v1/listings/{id}", h.get)
	mux.HandleFunc("POST /v1/listings/{id}/apply", h.apply)
	mux.HandleFunc("GET /v1/me/listings", h.mine)
	mux.HandleFunc("POST /v1/me/listings", h.create)
	mux.HandleFunc("PUT /v1/me/listings/{id}/close", h.close)
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
	status, code, message := 500, "internal_error", "İlanlar yüklenemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrNotFound), errors.Is(err, teamdomain.ErrNotFound):
		status, code, message = 404, "not_found", "İlan bulunamadı veya kapandı."
	case errors.Is(err, domain.ErrTooManyOpen):
		status, code, message = 409, "too_many_open", "Aynı anda en fazla 10 açık ilan olabilir. Önce eski bir ilanı kapat."
	case errors.Is(err, teamdomain.ErrQuotaExhausted):
		status, code, message = 409, "quota_exhausted", "Kullanılabilir takım başvuru hakkın kalmadı."
	case errors.Is(err, teamdomain.ErrDuplicate):
		status, code, message = 409, "duplicate_request", "Bu kulübe daha önce başvuru gönderdin."
	case errors.Is(err, teamdomain.ErrForbidden):
		status, code, message = 403, "forbidden", "Bu işlem hesabına açık değil."
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", fields.Error()
	default:
		slog.Error("listing operation failed", "error", err)
	}
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}

func (h *Handler) actor(w http.ResponseWriter, r *http.Request, role string) (string, bool) {
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
	if role != "" && u.Role != role {
		failure(w, teamdomain.ErrForbidden)
		return "", false
	}
	if role == "" && u.Role != "player" && u.Role != "club" && u.Role != "coach" {
		failure(w, teamdomain.ErrForbidden)
		return "", false
	}
	return u.ID, true
}

func (h *Handler) open(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.actor(w, r, ""); !ok {
		return
	}
	page := 1
	if raw := r.URL.Query().Get("page"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil {
			failure(w, auth.ValidationError{"page": "Sayfa numarası geçersiz."})
			return
		}
		page = n
	}
	out, err := h.service.Open(r.Context(), r.URL.Query().Get("footballType"), page)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, out)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.actor(w, r, ""); !ok {
		return
	}
	out, err := h.service.Get(r.Context(), r.PathValue("id"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"listing": out})
}

func (h *Handler) apply(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "player")
	if !ok {
		return
	}
	if body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1)); err != nil || len(body) != 0 {
		failure(w, auth.ValidationError{"listing": "Başvuru isteği gövdesi boş olmalı."})
		return
	}
	request, quota, err := h.service.Apply(r.Context(), id, r.PathValue("id"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, map[string]any{"request": request, "quota": quota})
}

func (h *Handler) mine(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "club")
	if !ok {
		return
	}
	items, err := h.service.Mine(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"items": items})
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "club")
	if !ok {
		return
	}
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		failure(w, auth.ValidationError{"listing": "JSON biçiminde ilan gönder."})
		return
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	d.DisallowUnknownFields()
	var in application.Input
	if d.Decode(&in) != nil || d.Decode(&struct{}{}) != io.EOF {
		failure(w, auth.ValidationError{"listing": "Geçerli bir ilan gönder."})
		return
	}
	out, notified, err := h.service.Create(r.Context(), id, in)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, map[string]any{"listing": out, "notifiedPlayers": notified})
}

func (h *Handler) close(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "club")
	if !ok {
		return
	}
	out, err := h.service.Close(r.Context(), id, r.PathValue("id"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"listing": out})
}
