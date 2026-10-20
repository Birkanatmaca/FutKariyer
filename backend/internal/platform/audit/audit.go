// Package audit writes the append-only record of security-relevant actions
// (20 Oct 2026): every administrator write, sign-ins to the admin panel and
// account security events. Details never carry personal data: ids, counts
// and status codes only.
package audit

import (
	"context"
	"database/sql"
	"encoding/json"
	"net"
	"net/http"
	"regexp"
	"strings"
)

type Entry struct {
	ActorType   string // user, admin or system
	ActorID     string
	DelegatedBy string
	Action      string // e.g. admin.users.update, auth.password.changed
	TargetType  string
	TargetID    string
	Details     map[string]any
}

type Executor interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

type requestKey struct{}

type request struct{ ip, id string }

// WithRequest remembers the client address (and request id, when there is
// one) for entries written while serving the request.
func WithRequest(ctx context.Context, remoteAddr, requestID string) context.Context {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	return context.WithValue(ctx, requestKey{}, request{ip: host, id: requestID})
}

func Write(ctx context.Context, db Executor, e Entry) error {
	details := e.Details
	if details == nil {
		details = map[string]any{}
	}
	raw, err := json.Marshal(details)
	if err != nil {
		return err
	}
	req, _ := ctx.Value(requestKey{}).(request)
	var ip any
	if parsed := net.ParseIP(strings.TrimSpace(req.ip)); parsed != nil {
		ip = parsed.String()
	}
	_, err = db.ExecContext(ctx, `INSERT INTO audit_log(actor_type,actor_id,delegated_by,action,target_type,target_id,details,ip,request_id)
		VALUES($1,NULLIF($2,''),NULLIF($3,''),$4,$5,$6,$7,$8::inet,$9)`,
		e.ActorType, e.ActorID, e.DelegatedBy, e.Action, e.TargetType, e.TargetID, raw, ip, req.id)
	return err
}

// Middleware remembers each request's client address for entries written
// while it is served.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r.WithContext(WithRequest(r.Context(), r.RemoteAddr, r.Header.Get("X-Request-ID"))))
	})
}

var idSegment = regexp.MustCompile(`^([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9]+)$`)

// Route turns a request path into a stable action name and its first id:
// "PUT /v1/admin/users/<id>/password" becomes
// ("PUT /v1/admin/users/{id}/password", "<id>"). Nothing else from the
// request is recorded.
func Route(method, path string) (string, string) {
	parts := strings.Split(path, "/")
	target := ""
	for i, part := range parts {
		if idSegment.MatchString(part) {
			if target == "" {
				target = part
			}
			parts[i] = "{id}"
		}
	}
	action := method + " " + strings.Join(parts, "/")
	if len(action) > 120 {
		action = action[:120]
	}
	return action, target
}

// StatusRecorder remembers the status a handler wrote.
type StatusRecorder struct {
	http.ResponseWriter
	Status int
}

func (s *StatusRecorder) WriteHeader(code int) {
	if s.Status == 0 {
		s.Status = code
	}
	s.ResponseWriter.WriteHeader(code)
}

func (s *StatusRecorder) Write(b []byte) (int, error) {
	if s.Status == 0 {
		s.Status = http.StatusOK
	}
	return s.ResponseWriter.Write(b)
}

// Unwrap lets http.ResponseController reach the real writer (deadlines).
func (s *StatusRecorder) Unwrap() http.ResponseWriter { return s.ResponseWriter }
