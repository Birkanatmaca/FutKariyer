package migrations

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"

	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"
)

// Files travel with the API and migration binaries, independently of the cwd.
//
//go:embed *.sql
var files embed.FS

func NewProvider(db *sql.DB) (*goose.Provider, error) {
	locker, err := lock.NewPostgresSessionLocker(lock.WithLockTimeout(1, 60), lock.WithUnlockTimeout(1, 5))
	if err != nil {
		return nil, err
	}
	return goose.NewProvider(goose.DialectPostgres, db, files,
		goose.WithDisableGlobalRegistry(true),
		goose.WithSessionLocker(locker),
	)
}

// CheckCurrent reads migration state; the API never runs schema migrations.
func CheckCurrent(ctx context.Context, db *sql.DB) error {
	var table sql.NullString
	if err := db.QueryRowContext(ctx, "SELECT to_regclass('goose_db_version')::text").Scan(&table); err != nil {
		return fmt.Errorf("migration state could not be read: %w", err)
	}
	if !table.Valid {
		return errors.New("database schema is missing; run go run ./cmd/migrate up before starting the API")
	}
	provider, err := NewProvider(db)
	if err != nil {
		return err
	}
	current, target, err := provider.GetVersions(ctx)
	if err != nil {
		return fmt.Errorf("migration versions could not be read: %w", err)
	}
	if current != target {
		return fmt.Errorf("database schema version is %d, API requires %d; run the matching migration command before starting the API", current, target)
	}
	pending, err := provider.HasPending(ctx)
	if err != nil {
		return err
	}
	if pending {
		return errors.New("database has pending migrations; run go run ./cmd/migrate up")
	}
	return nil
}
