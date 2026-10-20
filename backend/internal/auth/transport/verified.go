package transport

import (
	"errors"
	"log/slog"
	"net/http"
	"regexp"

	"futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/auth/domain"
)

// Actions that reach other people need a verified email (20 Oct 2026):
// posting, replying, introductions and applications. Reading, liking and
// following stay open. Only enforced while email sending is configured.
var needsVerifiedEmail = []rule{
	{"", []string{http.MethodPost}, regexp.MustCompile(`^/v1/social/posts$`)},
	{"", []string{http.MethodPost}, regexp.MustCompile(`^/v1/social/posts/[^/]+/replies$`)},
	{"", []string{http.MethodPost}, regexp.MustCompile(`^/v1/connections$`)},
	{"", []string{http.MethodPost}, regexp.MustCompile(`^/v1/teams/[^/]+/join-requests$`)},
	{"", []string{http.MethodPost}, regexp.MustCompile(`^/v1/listings/[^/]+/apply$`)},
}

// VerifiedGuard refuses the listed actions for unverified self sign-ups.
func VerifiedGuard(service *application.Service, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if service.MailEnabled() && needsVerified(r) {
			err := service.RequireVerifiedEmail(r.Context(), bearer(r))
			if errors.Is(err, domain.ErrEmailUnverified) {
				writeError(w, 403, "email_unverified", "Bu işlem için önce e-posta adresini doğrula.", nil)
				return
			}
			// Unauthorized requests fall through to the handler's own answer.
			if err != nil && !errors.Is(err, domain.ErrUnauthorized) {
				slog.Error("email verification check failed", "error", err)
				writeError(w, 500, "internal_error", "İşlem tamamlanamadı. Biraz sonra tekrar dene.", nil)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func needsVerified(r *http.Request) bool {
	for _, item := range needsVerifiedEmail {
		if item.matches(r) {
			return true
		}
	}
	return false
}
