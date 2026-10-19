package transport

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/platform/ratelimit"
)

type Handler struct {
	service *application.Service
	limiter *ratelimit.Limiter
}

func New(service *application.Service) http.Handler {
	h := &Handler{service: service, limiter: ratelimit.New(20, time.Minute)}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) { write(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("POST /v1/auth/register", h.register)
	mux.HandleFunc("POST /v1/auth/login", h.login)
	mux.HandleFunc("POST /v1/auth/applications", h.apply)
	mux.HandleFunc("GET /v1/auth/me", h.me)
	mux.HandleFunc("POST /v1/auth/logout", h.logout)
	mux.HandleFunc("DELETE /v1/auth/account", h.deleteAccount)
	mux.HandleFunc("POST /v1/auth/switch", h.switchToClub)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		defer func() {
			if recovered := recover(); recovered != nil {
				slog.Error("request panic")
				writeError(w, 500, "internal_error", "İşlem tamamlanamadı. Biraz sonra tekrar dene.", nil)
			}
		}()
		mux.ServeHTTP(w, r)
	})
}
func write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func writeError(w http.ResponseWriter, status int, code, message string, fields any) {
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		writeError(w, 415, "invalid_content_type", "JSON içerik türü gerekli.", nil)
		return false
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16384))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(v); err != nil {
		writeError(w, 400, "invalid_request", "İstek bilgileri okunamadı.", nil)
		return false
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		writeError(w, 400, "invalid_request", "İstek bilgileri okunamadı.", nil)
		return false
	}
	return true
}
func (h *Handler) limited(w http.ResponseWriter, r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if !h.limiter.Allow(host) {
		w.Header().Set("Retry-After", "60")
		writeError(w, 429, "rate_limited", "Çok fazla deneme yaptın. Bir dakika sonra tekrar dene.", nil)
		return true
	}
	return false
}
func failure(w http.ResponseWriter, err error) {
	var fields application.ValidationError
	switch {
	case errors.As(err, &fields):
		writeError(w, 422, "validation_error", fields.Error(), fields)
	case errors.Is(err, domain.ErrEmailExists):
		writeError(w, 409, "email_exists", "Bu e-posta ile bir hesap var. Giriş yapabilirsin.", map[string]string{"email": "Bu e-posta zaten kullanımda."})
	case errors.Is(err, domain.ErrUnauthorized):
		writeError(w, 401, "unauthorized", "Giriş bilgilerin hatalı veya hesabının erişimi kapalı; oturumun da sona ermiş olabilir.", nil)
	case errors.Is(err, domain.ErrPendingApproval):
		writeError(w, 403, "pending_approval", "Başvurun yönetici onayı bekliyor. Onaylandığında bu bilgilerle giriş yapabilirsin.", nil)
	case errors.Is(err, domain.ErrApplicationRejected):
		writeError(w, 403, "application_rejected", "Başvurun onaylanmadı. Ayrıntı için Fut Career ekibiyle iletişime geç.", nil)
	case errors.Is(err, domain.ErrUsernameExists):
		writeError(w, 409, "username_exists", "Bu kullanıcı adı kullanımda.", map[string]string{"username": "Bu kullanıcı adı zaten kullanımda."})
	case errors.Is(err, domain.ErrForbidden):
		writeError(w, 403, "forbidden", "Bu işlem için yetkin yok.", nil)
	case errors.Is(err, domain.ErrWrongPortal):
		writeError(w, 403, "wrong_portal", "Yönetici hesabıyla webde /securityadmin adresinden giriş yap.", nil)
	default:
		slog.Error("auth operation failed", "error", err)
		writeError(w, 500, "internal_error", "İşlem tamamlanamadı. Biraz sonra tekrar dene.", nil)
	}
}
func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	if h.limited(w, r) {
		return
	}
	var in application.RegisterInput
	if !decode(w, r, &in) {
		return
	}
	result, err := h.service.Register(r.Context(), in)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, result)
}
func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	if h.limited(w, r) {
		return
	}
	var in application.LoginInput
	if !decode(w, r, &in) {
		return
	}
	result, err := h.service.Login(r.Context(), in)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, result)
}
func bearer(r *http.Request) string {
	parts := strings.Fields(r.Header.Get("Authorization"))
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		return parts[1]
	}
	return ""
}
func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	user, err := h.service.Me(r.Context(), bearer(r))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"user": user})
}
func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	token := bearer(r)
	if _, err := h.service.Me(r.Context(), token); err != nil {
		failure(w, err)
		return
	}
	if err := h.service.Logout(r.Context(), token); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// switchToClub gives a staff coach a session for the club (POST {clubId}).
func (h *Handler) switchToClub(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ClubID string `json:"clubId"`
	}
	if !decode(w, r, &in) {
		return
	}
	result, err := h.service.SwitchToClub(r.Context(), bearer(r), strings.TrimSpace(in.ClubID))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, result)
}

func (h *Handler) deleteAccount(w http.ResponseWriter, r *http.Request) {
	if h.limited(w, r) {
		return
	}
	var in struct {
		Password string `json:"password"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err := h.service.DeleteAccount(r.Context(), bearer(r), in.Password); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) apply(w http.ResponseWriter, r *http.Request) {
	if h.limited(w, r) {
		return
	}
	var in application.ApplyInput
	if !decode(w, r, &in) {
		return
	}
	if err := h.service.Apply(r.Context(), in); err != nil {
		failure(w, err)
		return
	}
	write(w, 201, map[string]string{"status": "pending"})
}
