package postgres

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// SlowQuery is when a statement is logged as db.slow_query.
const SlowQuery = 300 * time.Millisecond

type startKey struct{}

// slowQueryTracer logs statements slower than SlowQuery with the request
// that ran them. Only the SQL text is logged, never the parameters.
type slowQueryTracer struct {
	observe func(time.Duration)
}

func (t slowQueryTracer) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	return context.WithValue(context.WithValue(ctx, startKey{}, time.Now()), sqlKey{}, data.SQL)
}

func (t slowQueryTracer) TraceQueryEnd(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryEndData) {
	start, ok := ctx.Value(startKey{}).(time.Time)
	if !ok {
		return
	}
	d := time.Since(start)
	if t.observe != nil {
		t.observe(d)
	}
	if d < SlowQuery {
		return
	}
	attrs := []any{"duration_ms", d.Milliseconds(), "sql", compactSQL(data.CommandTag.String(), ctx)}
	if data.Err != nil {
		attrs = append(attrs, "error", data.Err.Error())
	}
	slog.WarnContext(ctx, "db.slow_query", attrs...)
}

type sqlKey struct{}

// compactSQL is the statement on one line, at most 200 characters.
func compactSQL(fallback string, ctx context.Context) string {
	text, _ := ctx.Value(sqlKey{}).(string)
	if text == "" {
		text = fallback
	}
	text = strings.Join(strings.Fields(text), " ")
	if len(text) > 200 {
		text = text[:200] + "…"
	}
	return text
}
