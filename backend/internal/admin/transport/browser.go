package transport

import (
	"errors"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	auth "futcareer/backend/internal/auth/application"
)

const cookieName = "futcareer_admin"

type BrowserConfig struct {
	origin string
	secure bool
}

func BrowserOrigin(raw string) (BrowserConfig, error) {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" || parsed.User != nil || (parsed.Path != "" && parsed.Path != "/") || parsed.RawQuery != "" || parsed.Fragment != "" {
		return BrowserConfig{}, errors.New("ADMIN_ORIGIN must contain only scheme and host, for example https://example.com")
	}
	host := strings.ToLower(parsed.Hostname())
	ip := net.ParseIP(host)
	loopback := host == "localhost" || (ip != nil && ip.IsLoopback())
	if parsed.Scheme != "https" && !(parsed.Scheme == "http" && loopback) {
		return BrowserConfig{}, errors.New("ADMIN_ORIGIN requires HTTPS except for localhost development")
	}
	parsed.Path = ""
	parsed.Host = strings.ToLower(parsed.Host)
	return BrowserConfig{origin: parsed.String(), secure: parsed.Scheme == "https"}, nil
}
func (h *Handler) cookie(w http.ResponseWriter, token string, expires time.Time) {
	age := int(time.Until(expires).Seconds())
	if age < 1 {
		age = 1
	}
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: token, Path: "/", HttpOnly: true, Secure: h.browser.secure, SameSite: http.SameSiteStrictMode, Expires: expires, MaxAge: age})
}
func (h *Handler) clearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: "", Path: "/", HttpOnly: true, Secure: h.browser.secure, SameSite: http.SameSiteStrictMode, Expires: time.Unix(1, 0), MaxAge: -1})
}
func cookieToken(r *http.Request) string {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}
func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if !h.limiter.Allow(host) {
		w.Header().Set("Retry-After", "60")
		writeError(w, 429, "rate_limited", "Çok fazla deneme yaptın. Bir dakika sonra tekrar dene.", nil)
		return
	}
	var in auth.LoginInput
	if !decode(w, r, &in) {
		return
	}
	result, err := h.auth.AdminLogin(r.Context(), in)
	if err != nil {
		failure(w, err)
		return
	}
	if old := cookieToken(r); old != "" {
		if err = h.auth.Logout(r.Context(), old); err != nil {
			_ = h.auth.Logout(r.Context(), result.Token)
			failure(w, err)
			return
		}
	}
	h.cookie(w, result.Token, result.ExpiresAt)
	write(w, 200, map[string]any{"user": result.User, "expiresAt": result.ExpiresAt})
}
func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if err := h.auth.Logout(r.Context(), cookieToken(r)); err != nil {
		failure(w, err)
		return
	}
	h.clearCookie(w)
	w.WriteHeader(204)
}
