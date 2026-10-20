package application

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"futcareer/backend/internal/platform/logging"
	"futcareer/backend/internal/systemlogs/domain"
)

// Writer keeps the log lines worth keeping in the database. It never blocks
// the request that logs: lines wait in a buffer and are written in batches;
// when the buffer is full they are counted as dropped (stdout still has
// them). Its own failures go to stderr, never back into the log.
type Writer struct {
	repo          domain.Repository
	lines         chan domain.Entry
	storeRequests atomic.Bool
	dropped       atomic.Int64
}

const (
	bufferSize = 5000
	batchSize  = 200
	flushEvery = 2 * time.Second
)

func NewWriter(repo domain.Repository) *Writer {
	return &Writer{repo: repo, lines: make(chan domain.Entry, bufferSize)}
}

// kept: problems, security events, app error reports, slow work, and every
// request only when the panel switched that on.
func (w *Writer) keep(e logging.Entry) bool {
	if e.Level == "WARN" || e.Level == "ERROR" {
		return true
	}
	if b, _ := e.Attrs["security"].(bool); b {
		return true
	}
	switch e.Event {
	case logging.EventClientErr, logging.EventSlow, logging.EventSlowQuery:
		return true
	case logging.EventRequest:
		// The log page's own (auto-refresh) reads would fill the table.
		route, _ := e.Attrs["route"].(string)
		return w.storeRequests.Load() && !strings.Contains(route, "/v1/admin/logs")
	}
	return false
}

// Accept implements logging.Sink.
func (w *Writer) Accept(e logging.Entry) {
	if !w.keep(e) {
		return
	}
	select {
	case w.lines <- convert(e):
	default:
		w.dropped.Add(1)
	}
}

// Dropped is how many lines did not fit in the buffer since start.
func (w *Writer) Dropped() int64 { return w.dropped.Load() }

func text(attrs map[string]any, key string) string {
	v, ok := attrs[key]
	if !ok {
		return ""
	}
	delete(attrs, key)
	s, _ := v.(string)
	return s
}

func number(attrs map[string]any, key string) int {
	v, ok := attrs[key]
	if !ok {
		return 0
	}
	delete(attrs, key)
	switch n := v.(type) {
	case int64:
		return int(n)
	case int:
		return n
	case float64:
		return int(n)
	case uint64:
		return int(n)
	}
	return 0
}

func clip(s string, n int) string {
	s = strings.ToValidUTF8(s, "")
	if len(s) > n {
		return s[:n]
	}
	return s
}

func convert(e logging.Entry) domain.Entry {
	attrs := make(map[string]any, len(e.Attrs))
	for k, v := range e.Attrs {
		if s, ok := v.(string); ok {
			v = clip(s, 4000)
		}
		attrs[k] = v
	}
	out := domain.Entry{At: e.Time.UTC(), Level: e.Level, Event: clip(e.Event, 120), Version: e.Version,
		RequestID: text(attrs, "request_id"), Method: text(attrs, "method"), Route: text(attrs, "route"),
		Status: number(attrs, "status"), DurationMS: number(attrs, "duration_ms"),
		UserID: text(attrs, "user_id"), AccountType: text(attrs, "account_type"), IP: text(attrs, "ip"),
		Client: text(attrs, "client"), AppVersion: text(attrs, "app_version")}
	if b, ok := attrs["security"].(bool); ok {
		out.Security = b
		delete(attrs, "security")
	}
	for _, key := range []string{"error", "message", "detail", "panic", "reason"} {
		if m := text(attrs, key); m != "" && out.Message == "" {
			out.Message = clip(m, 1000)
		} else if m != "" {
			attrs[key] = m
		}
	}
	if out.Level != "DEBUG" && out.Level != "INFO" && out.Level != "WARN" && out.Level != "ERROR" {
		out.Level = "INFO"
	}
	out.Attrs = attrs
	return out
}

// Run writes batches until ctx ends, then flushes what is left.
func (w *Writer) Run(ctx context.Context) {
	ticker := time.NewTicker(flushEvery)
	defer ticker.Stop()
	batch := make([]domain.Entry, 0, batchSize)
	flush := func(ctx context.Context) {
		if len(batch) == 0 {
			return
		}
		if err := w.repo.Insert(ctx, batch); err != nil {
			w.dropped.Add(int64(len(batch)))
			fmt.Fprintf(os.Stderr, "system log write failed (%d lines): %v\n", len(batch), err)
		}
		batch = batch[:0]
	}
	for {
		select {
		case <-ctx.Done():
			// Drain what is buffered, with a short deadline of its own.
			final, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			for {
				select {
				case e := <-w.lines:
					batch = append(batch, e)
					if len(batch) >= batchSize {
						flush(final)
					}
					continue
				default:
				}
				break
			}
			flush(final)
			cancel()
			return
		case e := <-w.lines:
			batch = append(batch, e)
			if len(batch) >= batchSize {
				flush(ctx)
			}
		case <-ticker.C:
			flush(ctx)
		}
	}
}
