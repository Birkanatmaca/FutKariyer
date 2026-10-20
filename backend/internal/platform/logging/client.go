package logging

import (
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"

	"futcareer/backend/internal/platform/ratelimit"
)

// ClientError is what the mobile app and the admin panel send when their
// code fails (POST /v1/client-errors): the JavaScript error, where it
// happened and the app version. No account data is sent or accepted.
type ClientError struct {
	Source     string `json:"source"` // mobile or admin
	Message    string `json:"message"`
	Stack      string `json:"stack"`
	Screen     string `json:"screen"`
	Fatal      bool   `json:"fatal"`
	RequestID  string `json:"requestId"`
	AppVersion string `json:"appVersion"`
}

var (
	emailLike  = regexp.MustCompile(`[^\s@"']+@[^\s@"']+\.[A-Za-z]{2,}`)
	longDigits = regexp.MustCompile(`\d{7,}`)
)

// scrub removes what looks like an email or a phone/card number from text
// written by the client.
func scrub(text string, limit int) string {
	text = emailLike.ReplaceAllString(text, "[e-posta]")
	text = longDigits.ReplaceAllString(text, "[sayı]")
	text = strings.ToValidUTF8(text, "")
	if len(text) > limit {
		text = text[:limit]
	}
	return text
}

// ClientErrors accepts error reports from the apps, at most 30 a minute per
// address, and writes them as client.error lines. count is called per report
// (metrics).
func ClientErrors(count func(source string, fatal bool)) http.Handler {
	limit := ratelimit.New(30, time.Minute)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			host = r.RemoteAddr
		}
		if !limit.Allow(host) {
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		var in ClientError
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16384)).Decode(&in); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if in.Source != "mobile" && in.Source != "admin" {
			in.Source = "unknown"
		}
		attrs := []any{"source", in.Source, "fatal", in.Fatal,
			"message", scrub(in.Message, 500), "stack", scrub(in.Stack, 4000),
			"screen", clip(in.Screen, 80), "client_app_version", clip(in.AppVersion, 32)}
		if validRequestID.MatchString(in.RequestID) {
			attrs = append(attrs, "failed_request_id", in.RequestID)
		}
		level := slog.LevelWarn
		if in.Fatal {
			level = slog.LevelError
		}
		slog.Log(r.Context(), level, EventClientErr, attrs...)
		if count != nil {
			count(in.Source, in.Fatal)
		}
		w.WriteHeader(http.StatusNoContent)
	})
}
