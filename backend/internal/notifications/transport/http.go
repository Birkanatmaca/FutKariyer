package transport

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/notifications/application"
	"futcareer/backend/internal/notifications/domain"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
}

func New(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{auth: authService, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/me/notifications", h.list)
	mux.HandleFunc("GET /v1/me/notifications/unread-count", h.unreadCount)
	mux.HandleFunc("PUT /v1/me/notifications/read-all", h.markAllRead)
	mux.HandleFunc("PUT /v1/me/notifications/{id}/read", h.markRead)
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

func (h *Handler) failure(w http.ResponseWriter, err error) {
	status, code, message := 500, "internal_error", "Bildirimler yüklenemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "not_found", "Bildirim bulunamadı."
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", fields.Error()
	default:
		slog.Error("notification operation failed", "error", err)
	}
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}

func (h *Handler) userID(w http.ResponseWriter, r *http.Request) (string, bool) {
	parts := strings.Fields(r.Header.Get("Authorization"))
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		h.failure(w, authdomain.ErrUnauthorized)
		return "", false
	}
	user, err := h.auth.Me(r.Context(), parts[1])
	if err != nil {
		h.failure(w, err)
		return "", false
	}
	return user.ID, true
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

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.userID(w, r)
	if !ok {
		return
	}
	page, err := h.service.List(r.Context(), userID, pageNumber(r, "page", 1), pageNumber(r, "pageSize", 20))
	if err != nil {
		h.failure(w, err)
		return
	}
	write(w, http.StatusOK, page)
}

func (h *Handler) unreadCount(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.userID(w, r)
	if !ok {
		return
	}
	count, err := h.service.UnreadCount(r.Context(), userID)
	if err != nil {
		h.failure(w, err)
		return
	}
	write(w, http.StatusOK, map[string]int{"unreadCount": count})
}

func (h *Handler) markRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.userID(w, r)
	if !ok {
		return
	}
	if err := h.service.MarkRead(r.Context(), userID, r.PathValue("id")); err != nil {
		h.failure(w, err)
		return
	}
	count, err := h.service.UnreadCount(r.Context(), userID)
	if err != nil {
		h.failure(w, err)
		return
	}
	write(w, http.StatusOK, map[string]int{"unreadCount": count})
}

func (h *Handler) markAllRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.userID(w, r)
	if !ok {
		return
	}
	if err := h.service.MarkAllRead(r.Context(), userID); err != nil {
		h.failure(w, err)
		return
	}
	write(w, http.StatusOK, map[string]int{"unreadCount": 0})
}
