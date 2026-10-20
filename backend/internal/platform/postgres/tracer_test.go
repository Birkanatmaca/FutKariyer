package postgres_test

import (
	"bytes"
	"context"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"futcareer/backend/internal/platform/postgres"
)

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestSlowQueriesAreLoggedWithoutParameters(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	var buf bytes.Buffer
	old := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(old) })
	var observed []time.Duration
	db, err := postgres.Open(context.Background(), url, postgres.Options{MaxConns: 2, ObserveQuery: func(d time.Duration) { observed = append(observed, d) }})
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err = db.Exec(`SELECT 1 WHERE $1 <> ''`, "fast-secret"); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(buf.String(), "db.slow_query") {
		t.Fatalf("fast query logged: %s", buf.String())
	}
	if _, err = db.Exec(`SELECT pg_sleep(0.35), $1::text`, "very-secret-parameter"); err != nil {
		t.Fatal(err)
	}
	out := buf.String()
	if !strings.Contains(out, `"msg":"db.slow_query"`) || !strings.Contains(out, "SELECT pg_sleep(0.35), $1::text") || strings.Contains(out, "very-secret-parameter") {
		t.Fatalf("slow query line: %s", out)
	}
	if len(observed) < 2 {
		t.Fatalf("durations not observed: %v", observed)
	}
}
