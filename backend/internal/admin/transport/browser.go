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

// BrowserOrigin validates the admin panel origin. Plain HTTP is accepted only
// for loopback, or when allowInsecure is set explicitly (ADMIN_ALLOW_INSECURE_HTTP)
// for a server without a domain yet; the session cookie is then sent unencrypted.
func BrowserOrigin(raw string, allowInsecure bool) (BrowserConfig, error) {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" || parsed.User != nil || (parsed.Path != "" && parsed.Path != "/") || parsed.RawQuery != "" || parsed.Fragment != "" {
		return BrowserConfig{}, errors.New("ADMIN_ORIGIN must contain only scheme and host, for example https://example.com")
	}
	host := strings.ToLower(parsed.Hostname())
	ip := net.ParseIP(host)
	loopback := host == "localhost" || (ip != nil && ip.IsLoopback())
	if parsed.Scheme != "https" && !(parsed.Scheme == "http" && (loopback || allowInsecure)) {
		return BrowserConfig{}, errors.New("ADMIN_ORIGIN requires HTTPS except for localhost development or ADMIN_ALLOW_INSECURE_HTTP=true")
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

// bearerToken returns the token of an "Authorization: Bearer" header, used by the mobile app.
func bearerToken(r *http.Request) (string, bool) {
	value := r.Header.Get("Authorization")
	if !strings.HasPrefix(value, "Bearer ") {
		return "", false
	}
	return strings.TrimSpace(strings.TrimPrefix(value, "Bearer ")), true
}

// allowLogin rate-limits admin login attempts per client address.
func (h *Handler) allowLogin(w http.ResponseWriter, r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if !h.limiter.Allow(host) {
		w.Header().Set("Retry-After", "60")
		writeError(w, 429, "rate_limited", "Çok fazla deneme yaptın. Bir dakika sonra tekrar dene.", nil)
		return false
	}
	return true
}

// tokenLogin signs an admin in from the mobile app and returns the session
// token in the body; the web panel keeps using the HttpOnly cookie login.
func (h *Handler) tokenLogin(w http.ResponseWriter, r *http.Request) {
	if !h.allowLogin(w, r) {
		return
	}
	var in auth.LoginInput
	if !decode(w, r, &in) {
		return
	}
	in.Device = r.Header.Get("X-Device")
	result, err := h.auth.AdminSignIn(r.Context(), in)
	if err != nil {
		failure(w, err)
		return
	}
	if result.Challenge != nil {
		write(w, 200, map[string]any{"twoFactor": result.Challenge})
		return
	}
	write(w, 200, map[string]any{"token": result.Session.Token, "user": result.Session.User, "expiresAt": result.Session.ExpiresAt})
}

type secondFactorInput struct {
	Challenge string `json:"challenge"`
	Code      string `json:"code"`
}

// tokenSecondFactor finishes a mobile admin sign-in with the authenticator
// (or a recovery) code.
func (h *Handler) tokenSecondFactor(w http.ResponseWriter, r *http.Request) {
	if !h.allowLogin(w, r) {
		return
	}
	var in secondFactorInput
	if !decode(w, r, &in) {
		return
	}
	result, err := h.auth.AdminVerify(r.Context(), in.Challenge, in.Code, r.Header.Get("X-Device"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"token": result.Token, "user": result.User, "expiresAt": result.ExpiresAt, "recoveryCodes": result.RecoveryCodes})
}

// secondFactor finishes a web admin sign-in and sets the session cookie.
func (h *Handler) secondFactor(w http.ResponseWriter, r *http.Request) {
	if !h.allowLogin(w, r) {
		return
	}
	var in secondFactorInput
	if !decode(w, r, &in) {
		return
	}
	result, err := h.auth.AdminVerify(r.Context(), in.Challenge, in.Code, r.UserAgent())
	if err != nil {
		failure(w, err)
		return
	}
	if old := cookieToken(r); old != "" {
		_ = h.auth.Logout(r.Context(), old)
	}
	h.cookie(w, result.Token, result.ExpiresAt)
	write(w, 200, map[string]any{"user": result.User, "expiresAt": result.ExpiresAt, "recoveryCodes": result.RecoveryCodes})
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	if !h.allowLogin(w, r) {
		return
	}
	var in auth.LoginInput
	if !decode(w, r, &in) {
		return
	}
	in.Device = r.UserAgent()
	signIn, err := h.auth.AdminSignIn(r.Context(), in)
	if err != nil {
		failure(w, err)
		return
	}
	if signIn.Challenge != nil {
		write(w, 200, map[string]any{"twoFactor": signIn.Challenge})
		return
	}
	result := *signIn.Session
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
	token, bearer := bearerToken(r)
	if !bearer {
		token = cookieToken(r)
	}
	if err := h.auth.Logout(r.Context(), token); err != nil {
		failure(w, err)
		return
	}
	if !bearer {
		h.clearCookie(w)
	}
	w.WriteHeader(204)
}
