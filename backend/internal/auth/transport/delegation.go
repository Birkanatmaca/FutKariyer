package transport

import (
	"errors"
	"net/http"
	"regexp"
	"slices"

	"futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/platform/audit"
	"futcareer/backend/internal/platform/logging"
)

// The single policy for switched sessions (a staff coach running a club
// account, 19 Oct 2026). The club's private areas are closed outright; a club
// section's reads and writes need that section's permission; other reads are
// open and every other write is refused, so new endpoints stay closed to
// switched sessions until listed here.
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
	{"profile", []string{http.MethodPut, http.MethodDelete}, regexp.MustCompile(`^/v1/me/club-profile(/tff)?$`)},
	{"social", []string{http.MethodPost, http.MethodPut, http.MethodDelete}, regexp.MustCompile(`^/v1/social/`)},
	{"social", []string{http.MethodPut}, regexp.MustCompile(`^/v1/discovery/[^/]+/[^/]+/follow$`)},
}

// The club account's own private areas (20 Oct 2026): its connections and
// their contact emails, profile visitors, blocks, technical staff, gifts,
// purchases and push devices. Closed for every method, whatever the club
// granted. The club's email is also blanked in /v1/auth/me and /v1/me/profile.
var privateAreas = []*regexp.Regexp{
	regexp.MustCompile(`^/v1/connections(/|$)`),
	regexp.MustCompile(`^/v1/me/profile-visitors(/|$)`),
	regexp.MustCompile(`^/v1/me/blocks(/|$)`),
	regexp.MustCompile(`^/v1/me/staff(/|$)`),
	regexp.MustCompile(`^/v1/gifts(/|$)`),
	regexp.MustCompile(`^/v1/me/pro(/|$)`),
	regexp.MustCompile(`^/v1/me/(pro-payments|team-request-payments|store-orders|store-purchases)(/|$)`),
	regexp.MustCompile(`^/v1/me/push-devices(/|$)`),
	regexp.MustCompile(`^/v1/me/(password|sessions)(/|$)`),
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
			logging.Fail(w, "auth.delegation.failed", err)
			writeError(w, 500, "internal_error", "İşlem tamamlanamadı. Biraz sonra tekrar dene.", nil)
			return
		}
		if !delegated {
			next.ServeHTTP(w, r)
			return
		}
		if allowed(r, permissions) {
			if r.Method == http.MethodGet || r.Method == http.MethodHead {
				next.ServeHTTP(w, r)
				return
			}
			// Every write a coach makes for a club goes to the audit log.
			recorder := &audit.StatusRecorder{ResponseWriter: w}
			next.ServeHTTP(recorder, r)
			if recorder.Status > 0 && recorder.Status < 400 {
				action, target := audit.Route(r.Method, r.URL.Path)
				service.AuditDelegatedWrite(r.Context(), bearer(r), action, target)
			}
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		logging.Warn(w, logging.EventForbidden, nil, "security", true, "reason", "delegate_section")
		writeError(w, 403, "delegate_forbidden", "Kulüp bu bölüm için sana yetki vermedi.", nil)
	})
}

func allowed(r *http.Request, permissions []string) bool {
	for _, area := range privateAreas {
		if area.MatchString(r.URL.Path) {
			return false
		}
	}
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
