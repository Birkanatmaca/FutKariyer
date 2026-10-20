package logging

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"regexp"
	"runtime/debug"
	"strings"
	"sync"
	"time"
)

type infoKey struct{}

// Info is what the logs know about the request being served. The auth layer
// fills in the account once the session is checked.
type Info struct {
	mu          sync.Mutex
	RequestID   string
	Method      string
	Route       string
	IP          string
	Client      string
	AppVersion  string
	UserID      string
	AccountType string
	DelegatedBy string
	err         error
	event       string
}

func (i *Info) attrs() []slog.Attr {
	i.mu.Lock()
	defer i.mu.Unlock()
	attrs := []slog.Attr{slog.String("request_id", i.RequestID), slog.String("route", i.Route)}
	if i.UserID != "" {
		attrs = append(attrs, slog.String("user_id", i.UserID), slog.String("account_type", i.AccountType))
	}
	if i.DelegatedBy != "" {
		attrs = append(attrs, slog.String("delegated_by", i.DelegatedBy))
	}
	return attrs
}

func infoFrom(ctx context.Context) *Info {
	info, _ := ctx.Value(infoKey{}).(*Info)
	return info
}

// RequestID is the current request's id ("" outside a request).
func RequestID(ctx context.Context) string {
	if info := infoFrom(ctx); info != nil {
		return info.RequestID
	}
	return ""
}

// SetUser records the signed-in account for the request's log lines.
func SetUser(ctx context.Context, userID, accountType, delegatedBy string) {
	if info := infoFrom(ctx); info != nil {
		info.mu.Lock()
		info.UserID, info.AccountType, info.DelegatedBy = userID, accountType, delegatedBy
		info.mu.Unlock()
	}
}

var idSegment = regexp.MustCompile(`^([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9]+|[A-Za-z0-9_-]{43})$`)

// Route is the path with ids replaced by {id}, so lines group by endpoint
// and no identifier from the path ends up in the route.
func Route(path string) (string, string) {
	parts := strings.Split(path, "/")
	first := ""
	for i, part := range parts {
		if idSegment.MatchString(part) {
			if first == "" {
				first = part
			}
			parts[i] = "{id}"
		}
	}
	route := strings.Join(parts, "/")
	if len(route) > 160 {
		route = route[:160]
	}
	return route, first
}

var validRequestID = regexp.MustCompile(`^[A-Za-z0-9-]{8,64}$`)

// newRequestID is time-ordered: 12 hex characters of milliseconds, then 12
// random ones.
func newRequestID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	ms := time.Now().UnixMilli()
	t := []byte{byte(ms >> 40), byte(ms >> 32), byte(ms >> 24), byte(ms >> 16), byte(ms >> 8), byte(ms)}
	return hex.EncodeToString(t) + hex.EncodeToString(b)
}

// writer records the status and size and carries the request info, so an
// error handler that only has the ResponseWriter can still report.
type writer struct {
	http.ResponseWriter
	info   *Info
	status int
	bytes  int
}

func (w *writer) WriteHeader(code int) {
	if w.status == 0 {
		w.status = code
	}
	w.ResponseWriter.WriteHeader(code)
}
func (w *writer) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	n, err := w.ResponseWriter.Write(b)
	w.bytes += n
	return n, err
}
func (w *writer) Unwrap() http.ResponseWriter { return w.ResponseWriter }

// SlowRequest is when a request is also logged as http.slow.
const SlowRequest = time.Second

// quiet paths are probes; they are not access-logged.
var quiet = map[string]bool{"/health": true, "/ready": true, "/metrics": true}

// Middleware gives every request an id (X-Request-ID, echoed back), recovers
// panics with their stack, and writes one http.request line when it ends.
func Middleware(next http.Handler, observe func(method, route string, status int, d time.Duration)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		id := r.Header.Get("X-Request-ID")
		if !validRequestID.MatchString(id) {
			id = newRequestID()
		}
		route, _ := Route(r.URL.Path)
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			host = r.RemoteAddr
		}
		info := &Info{RequestID: id, Method: r.Method, Route: route, IP: MaskIP(host),
			Client: clip(r.Header.Get("X-Client"), 16), AppVersion: clip(r.Header.Get("X-App-Version"), 32)}
		w.Header().Set("X-Request-ID", id)
		lw := &writer{ResponseWriter: w, info: info}
		ctx := context.WithValue(r.Context(), infoKey{}, info)
		defer func() {
			if recovered := recover(); recovered != nil {
				if recovered == http.ErrAbortHandler {
					panic(recovered)
				}
				slog.ErrorContext(ctx, EventPanic, "panic", panicText(recovered), "stack", string(debug.Stack()))
				if lw.status == 0 {
					lw.Header().Set("Content-Type", "application/json; charset=utf-8")
					lw.WriteHeader(http.StatusInternalServerError)
					_ = json.NewEncoder(lw).Encode(map[string]any{"error": map[string]any{"code": "internal_error", "message": "İşlem tamamlanamadı. Biraz sonra tekrar dene.", "requestId": id}})
				} else {
					lw.status = http.StatusInternalServerError
				}
			}
			duration := time.Since(start)
			if observe != nil {
				observe(r.Method, route, lw.status, duration)
			}
			if quiet[r.URL.Path] {
				return
			}
			status := lw.status
			if status == 0 {
				status = http.StatusOK
			}
			attrs := []any{"method", r.Method, "status", status, "duration_ms", duration.Milliseconds(),
				"bytes_out", lw.bytes, "ip", info.IP}
			if r.ContentLength > 0 {
				attrs = append(attrs, "bytes_in", r.ContentLength)
			}
			if info.Client != "" {
				attrs = append(attrs, "client", info.Client, "app_version", info.AppVersion)
			}
			info.mu.Lock()
			if info.err != nil {
				attrs = append(attrs, "error", info.err.Error(), "error_event", info.event)
			}
			info.mu.Unlock()
			level := slog.LevelInfo
			if status >= 500 {
				level = slog.LevelWarn
			}
			slog.Log(ctx, level, EventRequest, attrs...)
			if duration >= SlowRequest {
				slog.WarnContext(ctx, EventSlow, "duration_ms", duration.Milliseconds())
			}
		}()
		next.ServeHTTP(lw, r.WithContext(ctx))
	})
}

// Fail reports an unexpected error of the request served by w: an ERROR
// line with the request's id, route and account, and the error on its
// access line. event names what failed, e.g. "social.post.failed".
func Fail(w http.ResponseWriter, event string, err error) {
	info := infoFromWriter(w)
	if info == nil {
		slog.Error(event, "error", errText(err))
		return
	}
	info.mu.Lock()
	info.err, info.event = err, event
	info.mu.Unlock()
	slog.ErrorContext(context.WithValue(context.Background(), infoKey{}, info), event, "error", errText(err))
}

// Warn reports an expected but notable problem (an upstream that is down,
// a rate limit) with the request's fields.
func Warn(w http.ResponseWriter, event string, err error, attrs ...any) {
	info := infoFromWriter(w)
	ctx := context.Background()
	if info != nil {
		ctx = context.WithValue(ctx, infoKey{}, info)
	}
	if err != nil {
		attrs = append(attrs, "error", errText(err))
	}
	slog.WarnContext(ctx, event, attrs...)
}

func infoFromWriter(w http.ResponseWriter) *Info {
	for w != nil {
		if lw, ok := w.(*writer); ok {
			return lw.info
		}
		u, ok := w.(interface{ Unwrap() http.ResponseWriter })
		if !ok {
			return nil
		}
		w = u.Unwrap()
	}
	return nil
}

func errText(err error) string {
	if err == nil {
		return ""
	}
	if errors.Is(err, context.Canceled) {
		return "context canceled (client went away)"
	}
	return err.Error()
}

func panicText(v any) string {
	if err, ok := v.(error); ok {
		return err.Error()
	}
	if s, ok := v.(string); ok {
		return s
	}
	return "panic"
}

func clip(s string, n int) string {
	s = strings.Map(func(r rune) rune {
		if r < 32 || r > 126 {
			return -1
		}
		return r
	}, s)
	if len(s) > n {
		return s[:n]
	}
	return s
}
