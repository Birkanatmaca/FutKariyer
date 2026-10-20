package transport

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/connections/application"
	"futcareer/backend/internal/connections/domain"
	"futcareer/backend/internal/platform/logging"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
}

func New(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{auth: authService, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/connections", h.inbox)
	mux.HandleFunc("POST /v1/connections", h.send)
	mux.HandleFunc("PUT /v1/connections/{id}", h.respond)
	mux.HandleFunc("GET /v1/connections/with/{userId}", h.status)
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
	status, code, message := 500, "internal_error", "İstekler yüklenemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "not_found", "Profil veya istek bulunamadı."
	case errors.Is(err, domain.ErrDuplicate):
		status, code, message = 409, "already_open", "Bu hesapla zaten bekleyen bir istek veya bağlantın var."
	case errors.Is(err, domain.ErrInvalidAction):
		status, code, message = 409, "invalid_action", "Bu istek için bu işlem artık yapılamaz. Listeyi yenile."
	case errors.Is(err, domain.ErrRateLimited):
		status, code, message = 429, "rate_limited", "Bugün gönderebileceğin istek sınırına ulaştın. Yarın tekrar dene."
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", fields.Error()
	default:
		logging.Fail(w, "connection.failed", err)
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
		failure(w, domain.ErrNotFound)
		return "", false
	}
	return u.ID, true
}

func decode(w http.ResponseWriter, r *http.Request, out any) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		failure(w, auth.ValidationError{"request": "JSON biçiminde istek gönder."})
		return false
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	d.DisallowUnknownFields()
	if d.Decode(out) != nil || d.Decode(&struct{}{}) != io.EOF {
		failure(w, auth.ValidationError{"request": "Geçerli bir istek gönder."})
		return false
	}
	return true
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

func (h *Handler) send(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	var in struct {
		RecipientID string `json:"recipientId"`
		Message     string `json:"message"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.Send(r.Context(), id, in.RecipientID, in.Message)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, map[string]any{"connection": out})
}

func (h *Handler) respond(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	var in struct {
		Action string `json:"action"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.Respond(r.Context(), id, r.PathValue("id"), in.Action)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"connection": out})
}

func (h *Handler) status(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	out, err := h.service.Status(r.Context(), id, r.PathValue("userId"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, out)
}
