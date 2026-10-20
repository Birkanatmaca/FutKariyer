package transport

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/platform/logging"
	"futcareer/backend/internal/platform/ratelimit"
)

type Handler struct {
	service *application.Service
	// One bucket per kind of request, so a burst of one kind (e.g. sign-ups
	// from a shared network) does not block sign-ins.
	limits map[string]*ratelimit.Limiter
}

// Per-IP limits; forgot-password is also limited per email address.
func limits() map[string]*ratelimit.Limiter {
	return map[string]*ratelimit.Limiter{
		"register": ratelimit.New(10, time.Minute),
		"login":    ratelimit.New(20, time.Minute),
		"apply":    ratelimit.New(5, time.Minute),
		"delete":   ratelimit.New(5, time.Minute),
		"switch":   ratelimit.New(20, time.Minute),
		"password": ratelimit.New(10, time.Minute),
		"code":     ratelimit.New(10, time.Minute),
		"forgot":   ratelimit.New(5, time.Minute),
		"email":    ratelimit.New(5, time.Hour),
	}
}

func New(service *application.Service) http.Handler {
	h := &Handler{service: service, limits: limits()}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) { write(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("POST /v1/auth/register", h.register)
	mux.HandleFunc("POST /v1/auth/login", h.login)
	mux.HandleFunc("POST /v1/auth/applications", h.apply)
	mux.HandleFunc("GET /v1/auth/me", h.me)
	mux.HandleFunc("POST /v1/auth/logout", h.logout)
	mux.HandleFunc("DELETE /v1/auth/account", h.deleteAccount)
	mux.HandleFunc("POST /v1/auth/switch", h.switchToClub)
	mux.HandleFunc("POST /v1/auth/password/forgot", h.forgotPassword)
	mux.HandleFunc("POST /v1/auth/password/reset", h.resetPassword)
	mux.HandleFunc("POST /v1/auth/email/verify", h.verifyEmail)
	mux.HandleFunc("POST /v1/auth/email/resend", h.resendVerification)
	mux.HandleFunc("PUT /v1/me/password", h.changePassword)
	mux.HandleFunc("GET /v1/me/sessions", h.sessions)
	mux.HandleFunc("DELETE /v1/me/sessions", h.endOtherSessions)
	mux.HandleFunc("DELETE /v1/me/sessions/{id}", h.endSession)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
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

// device is the client's label for this phone: the X-Device header the app
// sends with every request, or the body field.
func device(r *http.Request, fromBody string) string {
	if fromBody != "" {
		return fromBody
	}
	return r.Header.Get("X-Device")
}
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return host
}
func (h *Handler) limited(w http.ResponseWriter, r *http.Request, kind string) bool {
	return h.limitedKey(w, kind, clientIP(r))
}
func (h *Handler) limitedKey(w http.ResponseWriter, kind, key string) bool {
	if !h.limits[kind].Allow(key) {
		logging.Warn(w, logging.EventRateLimit, nil, "security", true, "bucket", kind)
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
	case errors.Is(err, domain.ErrLoginLocked):
		var locked domain.LoginLockedError
		minutes := 1
		if errors.As(err, &locked) {
			if m := int(math.Ceil(time.Until(locked.Until).Minutes())); m > 1 {
				minutes = m
			}
			w.Header().Set("Retry-After", strconv.Itoa(minutes*60))
		}
		writeError(w, 429, "login_locked", fmt.Sprintf("Çok fazla hatalı şifre denendi. %d dakika sonra tekrar dene veya şifreni sıfırla.", minutes), nil)
	case errors.Is(err, domain.ErrCodeInvalid):
		writeError(w, 422, "code_invalid", "Kod hatalı veya süresi dolmuş. Yeni bir kod isteyebilirsin.", map[string]string{"code": "Kod hatalı veya süresi dolmuş."})
	case errors.Is(err, domain.ErrCodeTooSoon):
		w.Header().Set("Retry-After", "60")
		writeError(w, 429, "code_too_soon", "Yeni kod için bir dakika bekle.", nil)
	case errors.Is(err, domain.ErrMailUnavailable):
		writeError(w, 503, "mail_unavailable", "E-posta gönderimi henüz açık değil. Şifreni sıfırlamak için Fut Career ekibine yaz.", nil)
	case errors.Is(err, domain.ErrEmailUnverified):
		writeError(w, 403, "email_unverified", "Bu işlem için önce e-posta adresini doğrula.", nil)
	case errors.Is(err, domain.ErrNotFound):
		writeError(w, 404, "not_found", "Kayıt bulunamadı.", nil)
	case errors.Is(err, domain.ErrWrongPortal):
		writeError(w, 403, "wrong_portal", "Yönetici hesabıyla webde /securityadmin adresinden giriş yap.", nil)
	default:
		logging.Fail(w, "auth.failed", err)
		writeError(w, 500, "internal_error", "İşlem tamamlanamadı. Biraz sonra tekrar dene.", nil)
	}
}
func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	if h.limited(w, r, "register") {
		return
	}
	var in application.RegisterInput
	if !decode(w, r, &in) {
		return
	}
	in.Device = device(r, in.Device)
	result, err := h.service.Register(r.Context(), in)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, result)
}
func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	if h.limited(w, r, "login") {
		return
	}
	var in application.LoginInput
	if !decode(w, r, &in) {
		return
	}
	in.Device = device(r, in.Device)
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
	if h.limited(w, r, "switch") {
		return
	}
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
	if h.limited(w, r, "delete") {
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
	if h.limited(w, r, "apply") {
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

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) {
	if h.limited(w, r, "password") {
		return
	}
	var in struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err := h.service.ChangePassword(r.Context(), bearer(r), in.CurrentPassword, in.NewPassword); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) forgotPassword(w http.ResponseWriter, r *http.Request) {
	if h.limited(w, r, "forgot") {
		return
	}
	var in struct {
		Email string `json:"email"`
	}
	if !decode(w, r, &in) {
		return
	}
	if h.limitedKey(w, "email", strings.ToLower(strings.TrimSpace(in.Email))) {
		return
	}
	if err := h.service.ForgotPassword(r.Context(), in.Email); err != nil {
		failure(w, err)
		return
	}
	// The same answer whether or not the address has an account.
	write(w, 202, map[string]string{"status": "sent"})
}

func (h *Handler) resetPassword(w http.ResponseWriter, r *http.Request) {
	if h.limited(w, r, "code") {
		return
	}
	var in application.ResetInput
	if !decode(w, r, &in) {
		return
	}
	in.Device = device(r, in.Device)
	result, err := h.service.ResetPassword(r.Context(), in)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, result)
}

func (h *Handler) verifyEmail(w http.ResponseWriter, r *http.Request) {
	if h.limited(w, r, "code") {
		return
	}
	var in struct {
		Code string `json:"code"`
	}
	if !decode(w, r, &in) {
		return
	}
	user, err := h.service.VerifyEmail(r.Context(), bearer(r), in.Code)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"user": user})
}

func (h *Handler) resendVerification(w http.ResponseWriter, r *http.Request) {
	if h.limited(w, r, "code") {
		return
	}
	if err := h.service.SendVerification(r.Context(), bearer(r)); err != nil {
		failure(w, err)
		return
	}
	write(w, 202, map[string]string{"status": "sent"})
}

func (h *Handler) sessions(w http.ResponseWriter, r *http.Request) {
	list, err := h.service.Sessions(r.Context(), bearer(r))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"sessions": list})
}

func (h *Handler) endSession(w http.ResponseWriter, r *http.Request) {
	if err := h.service.EndSession(r.Context(), bearer(r), r.PathValue("id")); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) endOtherSessions(w http.ResponseWriter, r *http.Request) {
	if err := h.service.EndOtherSessions(r.Context(), bearer(r)); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
