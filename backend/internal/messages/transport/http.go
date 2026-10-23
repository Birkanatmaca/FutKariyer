package transport

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/messages/application"
	"futcareer/backend/internal/messages/domain"
	"futcareer/backend/internal/platform/logging"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
}

func New(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{auth: authService, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/me/conversations", h.inbox)
	mux.HandleFunc("GET /v1/me/conversations/{userId}/messages", h.thread)
	mux.HandleFunc("POST /v1/me/conversations/{userId}/messages", h.send)
	mux.HandleFunc("PUT /v1/me/conversations/{userId}/read", h.read)
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
	status, code, message := 500, "internal_error", "Mesajlar yüklenemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "not_found", "Bu hesap bulunamadı."
	case errors.Is(err, domain.ErrNotAllowed):
		status, code, message = 403, "not_allowed", "Bu hesapla mesajlaşamazsın. Mesajlaşma kabul edilmiş bağlantılar ve kulüp ile kadrosu arasında açıktır."
	case errors.Is(err, domain.ErrRateLimited):
		status, code, message = 429, "rate_limited", "Çok hızlı mesaj gönderiyorsun. Biraz bekleyip tekrar dene."
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", fields.Error()
	default:
		logging.Fail(w, "messages.failed", err)
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
	return u.ID, true
}

func (h *Handler) inbox(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	out, err := h.service.Inbox(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, out)
}

func (h *Handler) thread(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	out, err := h.service.Thread(r.Context(), id, r.PathValue("userId"), r.URL.Query().Get("cursor"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, out)
}

func (h *Handler) send(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		failure(w, auth.ValidationError{"request": "JSON biçiminde istek gönder."})
		return
	}
	var in struct {
		Body string `json:"body"`
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	d.DisallowUnknownFields()
	if d.Decode(&in) != nil || d.Decode(&struct{}{}) != io.EOF {
		failure(w, auth.ValidationError{"request": "Geçerli bir istek gönder."})
		return
	}
	out, err := h.service.Send(r.Context(), id, r.PathValue("userId"), in.Body)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, map[string]any{"message": out})
}

func (h *Handler) read(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	if err := h.service.MarkRead(r.Context(), id, r.PathValue("userId")); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
