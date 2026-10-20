package transport

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"futcareer/backend/internal/admin/application"
	"futcareer/backend/internal/admin/domain"
	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/platform/audit"
	"futcareer/backend/internal/platform/ratelimit"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
	browser BrowserConfig
	limiter *ratelimit.Limiter
}

func New(authService *auth.Service, service *application.Service, browser BrowserConfig, features http.Handler) http.Handler {
	h := &Handler{auth: authService, service: service, browser: browser, limiter: ratelimit.New(20, time.Minute)}
	mux := http.NewServeMux()
	if features != nil {
		// Every other admin path (content, leagues, gifts, applications,
		// announcements, payments, club overviews) belongs to a feature handler;
		// the account routes below are more specific and take precedence.
		mux.Handle("/v1/admin/", features)
	}
	mux.HandleFunc("POST /v1/admin/auth/logout", h.logout)
	mux.HandleFunc("GET /v1/admin/audit", h.auditLog)
	for _, kind := range []string{"users", "clubs"} {
		clubOnly := kind == "clubs"
		path := "/v1/admin/" + kind
		mux.HandleFunc("GET "+path, func(w http.ResponseWriter, r *http.Request) { h.list(w, r, clubOnly) })
		mux.HandleFunc("POST "+path, func(w http.ResponseWriter, r *http.Request) { h.create(w, r, clubOnly) })
		mux.HandleFunc("GET "+path+"/{id}", func(w http.ResponseWriter, r *http.Request) { h.get(w, r, clubOnly) })
		mux.HandleFunc("PUT "+path+"/{id}", func(w http.ResponseWriter, r *http.Request) { h.update(w, r, clubOnly) })
		mux.HandleFunc("DELETE "+path+"/{id}", func(w http.ResponseWriter, r *http.Request) { h.delete(w, r, clubOnly) })
		mux.HandleFunc("PUT "+path+"/{id}/password", func(w http.ResponseWriter, r *http.Request) { h.password(w, r, clubOnly) })
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		defer func() {
			if recover() != nil {
				slog.Error("admin request panic")
				writeError(w, 500, "internal_error", "İşlem tamamlanamadı. Biraz sonra tekrar dene.", nil)
			}
		}()
		// The mobile app authenticates with a bearer token. Browsers never attach
		// it on their own, so the Origin (CSRF) check only applies to cookie sessions.
		token, bearer := bearerToken(r)
		if r.Method == "POST" && r.URL.Path == "/v1/admin/auth/token" {
			h.tokenLogin(w, r)
			return
		}
		if r.Method == "POST" && r.URL.Path == "/v1/admin/auth/token/2fa" {
			h.tokenSecondFactor(w, r)
			return
		}
		if !bearer && r.Method != "GET" && r.Method != "HEAD" && (h.browser.origin == "" || r.Header.Get("Origin") != h.browser.origin) {
			writeError(w, 403, "invalid_origin", "Bu işlem yönetici panelinden yapılmalı.", nil)
			return
		}
		if r.Method == "POST" && r.URL.Path == "/v1/admin/auth/login" {
			h.login(w, r)
			return
		}
		if r.Method == "POST" && r.URL.Path == "/v1/admin/auth/2fa" {
			h.secondFactor(w, r)
			return
		}
		if !bearer {
			token = cookieToken(r)
		}
		user, err := h.auth.AdminMe(r.Context(), token)
		if err != nil {
			if errors.Is(err, authdomain.ErrUnauthorized) && !bearer {
				h.clearCookie(w)
			}
			failure(w, err)
			return
		}
		if user.Role != "admin" {
			writeError(w, 403, "forbidden", "Bu alan yalnızca yöneticilere açık.", nil)
			return
		}
		if r.Method == "GET" && r.URL.Path == "/v1/admin/auth/me" {
			write(w, 200, map[string]any{"user": user})
			return
		}
		if r.Method == "GET" || r.Method == "HEAD" {
			mux.ServeHTTP(w, r)
			return
		}
		// Every successful admin write goes to the audit log: who, which
		// route and which record; never the request body.
		recorder := &audit.StatusRecorder{ResponseWriter: w}
		mux.ServeHTTP(recorder, r)
		if recorder.Status > 0 && recorder.Status < 400 && r.URL.Path != "/v1/admin/auth/logout" {
			action, target := audit.Route(r.Method, r.URL.Path)
			h.auth.Audit(r.Context(), audit.Entry{ActorType: "admin", ActorID: user.ID, Action: "admin." + action, TargetID: target, Details: map[string]any{"status": recorder.Status}})
		}
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
func failure(w http.ResponseWriter, err error) {
	var fields auth.ValidationError
	switch {
	case errors.As(err, &fields):
		writeError(w, 422, "validation_error", fields.Error(), fields)
	case errors.Is(err, authdomain.ErrUnauthorized):
		writeError(w, 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap.", nil)
	case errors.Is(err, authdomain.ErrNotFound):
		writeError(w, 404, "not_found", "Kayıt bulunamadı. Listeyi yenile.", nil)
	case errors.Is(err, authdomain.ErrEmailExists):
		writeError(w, 409, "email_exists", "Bu e-posta zaten kullanımda.", map[string]string{"email": "Bu e-posta zaten kullanımda."})
	case errors.Is(err, authdomain.ErrUsernameExists):
		writeError(w, 409, "username_exists", "Bu kullanıcı adı zaten kullanımda.", map[string]string{"username": "Bu kullanıcı adı zaten kullanımda."})
	case errors.Is(err, domain.ErrProtected):
		writeError(w, 403, "protected_account", "Yönetici hesapları bu panelden değiştirilemez veya silinemez.", nil)
	case errors.Is(err, authdomain.ErrLoginLocked):
		writeError(w, 429, "login_locked", "Çok fazla hatalı şifre denendi. Birkaç dakika sonra tekrar dene.", nil)
	case errors.Is(err, authdomain.ErrCodeInvalid):
		writeError(w, 422, "code_invalid", "Kod doğru değil. Uygulamadaki güncel kodu veya bir kurtarma kodunu gir.", map[string]string{"code": "Kod doğru değil."})
	case errors.Is(err, authdomain.ErrChallengeInvalid):
		writeError(w, 401, "challenge_invalid", "Giriş adımının süresi doldu. Şifrenle yeniden giriş yap.", nil)
	case errors.Is(err, authdomain.ErrTwoFactorRequired):
		writeError(w, 403, "two_factor_required", "Bu giriş iki aşamalı doğrulama ister; uygulamayı güncelle.", nil)
	case errors.Is(err, authdomain.ErrWrongPortal):
		writeError(w, 403, "wrong_portal", "Bu giriş yalnızca yönetici hesapları için. Diğer hesaplarla mobil uygulamadan giriş yap.", nil)
	default:
		slog.Error("admin operation failed", "error", err)
		writeError(w, 500, "internal_error", "İşlem tamamlanamadı. Biraz sonra tekrar dene.", nil)
	}
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
func (h *Handler) list(w http.ResponseWriter, r *http.Request, clubOnly bool) {
	page, size := 1, 20
	var err error
	if v := r.URL.Query().Get("page"); v != "" {
		page, err = strconv.Atoi(v)
		if err != nil {
			page = 0
		}
	}
	if v := r.URL.Query().Get("pageSize"); v != "" {
		size, err = strconv.Atoi(v)
		if err != nil {
			size = 0
		}
	}
	result, err := h.service.List(r.Context(), domain.Query{Page: page, PageSize: size, Search: r.URL.Query().Get("search"), ClubsOnly: clubOnly})
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, result)
}
func (h *Handler) get(w http.ResponseWriter, r *http.Request, clubOnly bool) {
	result, err := h.service.Get(r.Context(), r.PathValue("id"), clubOnly)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"account": result})
}
func (h *Handler) create(w http.ResponseWriter, r *http.Request, clubOnly bool) {
	var in application.CreateInput
	if !decode(w, r, &in) {
		return
	}
	result, err := h.service.Create(r.Context(), in, clubOnly)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, map[string]any{"account": result})
}
func (h *Handler) update(w http.ResponseWriter, r *http.Request, clubOnly bool) {
	var in application.UpdateInput
	if !decode(w, r, &in) {
		return
	}
	result, err := h.service.Update(r.Context(), r.PathValue("id"), in, clubOnly)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"account": result})
}
func (h *Handler) delete(w http.ResponseWriter, r *http.Request, clubOnly bool) {
	if err := h.service.Delete(r.Context(), r.PathValue("id"), clubOnly); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(204)
}
func (h *Handler) password(w http.ResponseWriter, r *http.Request, clubOnly bool) {
	var in struct {
		Password string `json:"password"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err := h.service.ResetPassword(r.Context(), r.PathValue("id"), in.Password, clubOnly); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(204)
}

// auditLog pages the audit log (İşlem geçmişi): ?page, ?action (prefix),
// ?actor (an account id as actor, delegate or target).
func (h *Handler) auditLog(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	result, err := h.service.AuditLog(r.Context(), domain.AuditQuery{Page: page, PageSize: 50, Action: r.URL.Query().Get("action"), ActorID: r.URL.Query().Get("actor")})
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, result)
}
