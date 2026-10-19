package transport

import (
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"slices"

	"futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/auth/domain"
)

// The single policy for switched sessions (a staff coach running a club
// account, 19 Oct 2026). Reads are open; a club section's reads and writes
// need that section's permission; every other write is refused, so new
// endpoints stay closed to switched sessions until listed here.
type rule struct {
	permission string
	methods    []string // nil: any method
	path       *regexp.Regexp
}

var sectionRules = []rule{
	{"applications", nil, regexp.MustCompile(`^/v1/teams/me/join-requests(/|$)`)},
	{"squad", nil, regexp.MustCompile(`^/v1/me/squad(/|$)`)},
	{"listings", nil, regexp.MustCompile(`^/v1/me/listings(/|$)`)},
	{"news", nil, regexp.MustCompile(`^/v1/me/club-news$`)},
	{"tournaments", nil, regexp.MustCompile(`^/v1/me/tournament-entries(/|$)`)},
	{"tournaments", []string{http.MethodPost}, regexp.MustCompile(`^/v1/tournaments/[^/]+/entries$`)},
	{"profile", []string{http.MethodPut}, regexp.MustCompile(`^/v1/me/club-profile$`)},
	{"social", []string{http.MethodPost, http.MethodPut, http.MethodDelete}, regexp.MustCompile(`^/v1/social/`)},
	{"social", []string{http.MethodPut}, regexp.MustCompile(`^/v1/discovery/[^/]+/[^/]+/follow$`)},
}

// Writes a switched session may always make: leaving the club session and
// reading the club's notifications.
var openWrites = []rule{
	{"", []string{http.MethodPost}, regexp.MustCompile(`^/v1/auth/logout$`)},
	{"", []string{http.MethodPut}, regexp.MustCompile(`^/v1/me/notifications/(read-all|[^/]+/read)$`)},
}

func (r rule) matches(req *http.Request) bool {
	return (r.methods == nil || slices.Contains(r.methods, req.Method)) && r.path.MatchString(req.URL.Path)
}

// DelegationGuard applies the switched-session policy in front of the API.
// Ordinary sessions pass after one session lookup.
func DelegationGuard(service *application.Service, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		permissions, delegated, err := service.Delegation(r.Context(), bearer(r))
		if errors.Is(err, domain.ErrUnauthorized) {
			writeError(w, 401, "unauthorized", "Kulüp yetkin kaldırılmış olabilir. Kendi hesabına dön.", nil)
			return
		}
		if err != nil {
			slog.Error("delegation check failed", "error", err)
			writeError(w, 500, "internal_error", "İşlem tamamlanamadı. Biraz sonra tekrar dene.", nil)
			return
		}
		if !delegated || allowed(r, permissions) {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		writeError(w, 403, "delegate_forbidden", "Kulüp bu bölüm için sana yetki vermedi.", nil)
	})
}

func allowed(r *http.Request, permissions []string) bool {
	for _, section := range sectionRules {
		if section.matches(r) {
			return slices.Contains(permissions, section.permission)
		}
	}
	for _, open := range openWrites {
		if open.matches(r) {
			return true
		}
	}
	return r.Method == http.MethodGet || r.Method == http.MethodHead
}
