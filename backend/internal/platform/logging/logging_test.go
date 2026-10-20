package logging

import (
	"bytes"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func capture(t *testing.T) *bytes.Buffer {
	t.Helper()
	old := slog.Default()
	t.Cleanup(func() { slog.SetDefault(old) })
	var buf bytes.Buffer
	setup(&buf, "api", "test", "1.0.0+abc", "debug")
	return &buf
}

func lines(t *testing.T, buf *bytes.Buffer) []map[string]any {
	t.Helper()
	var out []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(buf.String()), "\n") {
		if line == "" {
			continue
		}
		var m map[string]any
		if err := json.Unmarshal([]byte(line), &m); err != nil {
			t.Fatalf("not JSON: %s", line)
		}
		out = append(out, m)
	}
	return out
}

func TestAccessLineAndErrorShareTheRequestID(t *testing.T) {
	buf := capture(t)
	h := Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		SetUser(r.Context(), "u1", "player", "")
		w.WriteHeader(500)
		Fail(w, "social.post.failed", errors.New("insert media: boom"))
	}), nil)
	r := httptest.NewRequest("POST", "/v1/social/posts/0123456789abcdef0123456789abcdef/replies", nil)
	r.Header.Set("X-Client", "ios")
	r.Header.Set("X-App-Version", "1.4.0 (52)")
	r.RemoteAddr = "85.105.12.34:5555"
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	id := w.Header().Get("X-Request-ID")
	if len(id) != 24 {
		t.Fatalf("request id %q", id)
	}
	got := lines(t, buf)
	if len(got) != 2 {
		t.Fatalf("lines: %v", got)
	}
	failure, access := got[0], got[1]
	if failure["event"] != "social.post.failed" || failure["level"] != "ERROR" || failure["request_id"] != id || failure["user_id"] != "u1" || failure["error"] != "insert media: boom" {
		t.Fatalf("error line: %v", failure)
	}
	if access["event"] != "http.request" || access["request_id"] != id || access["status"] != float64(500) ||
		access["route"] != "/v1/social/posts/{id}/replies" || access["ip"] != "85.105.12.0" ||
		access["client"] != "ios" || access["app_version"] != "1.4.0 (52)" || access["error_event"] != "social.post.failed" ||
		access["service"] != "api" || access["version"] != "1.0.0+abc" || access["level"] != "WARN" {
		t.Fatalf("access line: %v", access)
	}
}

func TestPanicIsRecoveredWithStack(t *testing.T) {
	buf := capture(t)
	h := Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { panic("nil map") }), nil)
	r := httptest.NewRequest("GET", "/v1/leagues", nil)
	r.Header.Set("X-Request-ID", "client-chosen-id-1")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 500 || !strings.Contains(w.Body.String(), `"requestId":"client-chosen-id-1"`) {
		t.Fatalf("response: %d %s", w.Code, w.Body)
	}
	got := lines(t, buf)
	if got[0]["event"] != "http.panic" || !strings.Contains(got[0]["stack"].(string), "logging_test.go") || got[1]["status"] != float64(500) {
		t.Fatalf("lines: %v", got)
	}
}

func TestProbesAreQuietAndSlowRequestsWarn(t *testing.T) {
	buf := capture(t)
	var observed []string
	h := Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/slow" {
			time.Sleep(SlowRequest + 10*time.Millisecond)
		}
	}), func(method, route string, status int, d time.Duration) { observed = append(observed, route) })
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/health", nil))
	if buf.Len() != 0 || len(observed) != 1 {
		t.Fatalf("probe logged: %s", buf)
	}
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/slow", nil))
	got := lines(t, buf)
	if len(got) != 2 || got[1]["event"] != "http.slow" {
		t.Fatalf("slow: %v", got)
	}
}

func TestHelpers(t *testing.T) {
	buf := capture(t)
	slog.Info("x", "token", Secret("s3cr3t-value"))
	if strings.Contains(buf.String(), "s3cr3t") || !strings.Contains(buf.String(), "[gizli]") {
		t.Fatalf("secret leaked: %s", buf)
	}
	for in, want := range map[string]string{"85.105.12.34": "85.105.12.0", "2a02:e0:1:2:3:4:5:6": "2a02:e0:1::", "::1": "::", "nonsense": ""} {
		if got := MaskIP(in); got != want {
			t.Errorf("MaskIP(%s)=%s want %s", in, got, want)
		}
	}
	route, id := Route("/v1/users/0123456789abcdef0123456789abcdef/avatar")
	if route != "/v1/users/{id}/avatar" || id == "" {
		t.Fatalf("route %s %s", route, id)
	}
}

func TestClientErrorsAreScrubbedAndLimited(t *testing.T) {
	buf := capture(t)
	counted := 0
	h := Middleware(ClientErrors(func(string, bool) { counted++ }), nil)
	body := `{"source":"mobile","message":"TypeError for deniz@example.com card 4111111111111111","stack":"at Feed (Feed.tsx:12)","screen":"SocialFeed","fatal":true,"appVersion":"1.0 (1)"}`
	r := httptest.NewRequest("POST", "/v1/client-errors", strings.NewReader(body))
	r.RemoteAddr = "10.0.0.1:1"
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 204 || counted != 1 {
		t.Fatalf("status %d counted %d", w.Code, counted)
	}
	out := buf.String()
	if strings.Contains(out, "deniz@example.com") || strings.Contains(out, "4111111111111111") || !strings.Contains(out, `"event":"client.error"`) || !strings.Contains(out, "Feed.tsx:12") {
		t.Fatalf("client error line: %s", out)
	}
	for i := 0; i < 30; i++ {
		r := httptest.NewRequest("POST", "/v1/client-errors", strings.NewReader(`{"source":"admin","message":"x"}`))
		r.RemoteAddr = "10.0.0.1:1"
		w = httptest.NewRecorder()
		h.ServeHTTP(w, r)
	}
	if w.Code != 429 {
		t.Fatalf("reports must be rate limited, got %d", w.Code)
	}
}
