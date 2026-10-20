package application_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"futcareer/backend/internal/platform/logging"
	"futcareer/backend/internal/systemlogs/application"
	"futcareer/backend/internal/systemlogs/data"
	"futcareer/backend/internal/systemlogs/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

type live struct{}

func (live) Requests() (float64, float64) { return 120, 3 }

func entry(level, event string, attrs map[string]any) logging.Entry {
	return logging.Entry{Time: time.Now(), Level: level, Event: event, Version: "test", Attrs: attrs}
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestSystemLogsKeepSearchSummariseAndExpire(t *testing.T) {
	db := testpostgres.New(t)
	ctx, cancel := context.WithCancel(context.Background())
	repo := data.New(db.DB)
	writer := application.NewWriter(repo)
	service := application.New(repo, writer, live{})
	done := make(chan struct{})
	go func() { writer.Run(ctx); close(done) }()

	requestID := "01a15ac5bdd87a92017396c2"
	writer.Accept(entry("INFO", "http.request", map[string]any{"request_id": "aaaa", "route": "/v1/leagues", "status": int64(200)}))
	writer.Accept(entry("INFO", "mail.logged", nil))
	writer.Accept(entry("ERROR", "social.failed", map[string]any{"request_id": requestID, "route": "/v1/social/posts", "user_id": "u1", "error": "insert media: boom"}))
	writer.Accept(entry("WARN", "http.request", map[string]any{"request_id": requestID, "route": "/v1/social/posts", "status": int64(500), "duration_ms": int64(1400), "method": "POST", "ip": "85.105.12.0"}))
	writer.Accept(entry("WARN", "auth.login.failed", map[string]any{"security": true, "reason": "wrong_password"}))
	writer.Accept(entry("WARN", "client.error", map[string]any{"source": "mobile", "message": "TypeError: x", "failed_request_id": requestID}))
	writer.Accept(entry("INFO", "http.slow", map[string]any{"route": "/v1/social/posts", "duration_ms": int64(1400), "reason": "x"}))
	cancel()
	<-done

	all, err := service.List(context.Background(), "", "", "", 24, 1)
	if err != nil {
		t.Fatal(err)
	}
	// The plain request and the debug-ish line are not kept by default.
	if all.Total != 5 {
		t.Fatalf("kept %d lines: %+v", all.Total, all.Items)
	}
	// The support code (last 8 of the request id) finds the error, its access
	// line and the app's report of the same request.
	byCode, _ := service.List(context.Background(), "", "017396c2", "", 24, 1)
	if byCode.Total != 3 {
		t.Fatalf("support code search: %+v", byCode.Items)
	}
	failure, _ := service.List(context.Background(), domain.KindErrors, "", "", 24, 1)
	if failure.Total != 1 || failure.Items[0].Message != "insert media: boom" || failure.Items[0].UserID != "u1" {
		t.Fatalf("errors: %+v", failure.Items)
	}
	security, _ := service.List(context.Background(), domain.KindSecurity, "", "", 24, 1)
	if security.Total != 1 || security.Items[0].Message != "wrong_password" {
		t.Fatalf("security: %+v", security.Items)
	}
	one, err := service.Get(context.Background(), failure.Items[0].ID)
	if err != nil || one.Event != "social.failed" {
		t.Fatalf("get: %+v %v", one, err)
	}
	if _, err = service.Get(context.Background(), 999999); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("missing line: %v", err)
	}
	summary, err := service.Summary(context.Background(), 24)
	if err != nil || summary.Errors != 1 || summary.Warnings != 3 || summary.Security != 1 || summary.ClientErrors != 1 || summary.Slow != 1 ||
		len(summary.TopEvents) == 0 || summary.Live.Requests != 120 || summary.Live.ServerErrors != 3 || len(summary.SlowRoutes) != 1 || summary.SlowRoutes[0].Route != "/v1/social/posts" {
		t.Fatalf("summary: %+v %v", summary, err)
	}

	// Settings are validated, stored and applied at once.
	var fields application.ValidationError
	if _, err = service.SaveSettings(context.Background(), domain.Settings{Level: "loud", RequestDays: 0, ProblemDays: 1, SecurityDays: 1}, "admin1"); !errors.As(err, &fields) || len(fields) != 4 {
		t.Fatalf("invalid settings: %v", err)
	}
	saved, err := service.SaveSettings(context.Background(), domain.Settings{Level: "debug", StoreRequests: true, RequestDays: 3, ProblemDays: 30, SecurityDays: 365}, "admin1")
	t.Cleanup(func() { logging.SetLevel("info") })
	if err != nil || saved.UpdatedBy != "admin1" || logging.Level() != "debug" {
		t.Fatalf("save: %+v %v (level %s)", saved, err, logging.Level())
	}

	// Retention: old lines go, recent ones stay.
	if _, err = db.DB.Exec(`UPDATE system_logs SET at=now()-interval '40 days' WHERE event='social.failed'`); err != nil {
		t.Fatal(err)
	}
	removed, err := repo.Cleanup(context.Background(), saved, time.Now())
	if err != nil || removed != 1 {
		t.Fatalf("cleanup removed %d: %v", removed, err)
	}
}
