package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
)

// Options tune the pool; zero values keep the defaults.
type Options struct {
	MaxConns int
	// ObserveQuery receives every statement's duration (metrics).
	ObserveQuery func(time.Duration)
}

// Open owns the shared connection pool. Feature repositories receive this pool
// from the composition root and never create schemas or close the pool.
func Open(ctx context.Context, databaseURL string, options ...Options) (*sql.DB, error) {
	var opts Options
	if len(options) > 0 {
		opts = options[0]
	}
	if strings.TrimSpace(databaseURL) == "" {
		return nil, errors.New("DATABASE_URL is required")
	}
	config, err := pgx.ParseConfig(databaseURL)
	if err != nil {
		// Parsing errors can contain the connection string, including credentials.
		return nil, errors.New("DATABASE_URL is not a valid PostgreSQL connection string")
	}
	if config.ConnectTimeout == 0 {
		config.ConnectTimeout = 5 * time.Second
	}
	config.Tracer = slowQueryTracer{observe: opts.ObserveQuery}
	db := stdlib.OpenDB(*config)
	maxConns := opts.MaxConns
	if maxConns <= 0 {
		maxConns = 10
	}
	db.SetMaxOpenConns(maxConns)
	db.SetMaxIdleConns(max(2, maxConns/2))
	db.SetConnMaxLifetime(30 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("PostgreSQL connection failed: %w", err)
	}
	return db, nil
}
