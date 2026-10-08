package testpostgres

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"os"
	"testing"
	"time"

	"futcareer/backend/internal/platform/postgres"
	"futcareer/backend/migrations"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
)

type Database struct {
	DB     *sql.DB
	config *pgx.ConnConfig
}

func New(t testing.TB) *Database {
	t.Helper()
	return newDatabase(t, true)
}

func NewUnmigrated(t testing.TB) *Database {
	t.Helper()
	return newDatabase(t, false)
}

func newDatabase(t testing.TB, applyMigrations bool) *Database {
	t.Helper()
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("PostgreSQL integration test requires TEST_DATABASE_URL pointing to a dedicated test database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	admin, err := postgres.Open(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	config, err := pgx.ParseConfig(databaseURL)
	if err != nil {
		admin.Close()
		t.Fatal("invalid TEST_DATABASE_URL")
	}
	var suffix [12]byte
	if _, err := rand.Read(suffix[:]); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	schema := "futcareer_test_" + hex.EncodeToString(suffix[:])
	identifier := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.ExecContext(ctx, "CREATE SCHEMA "+identifier); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	config.RuntimeParams["search_path"] = schema
	database := &Database{config: config}
	t.Cleanup(func() {
		if database.DB != nil {
			database.DB.Close()
		}
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cleanupCancel()
		if _, err := admin.ExecContext(cleanupCtx, "DROP SCHEMA "+identifier+" CASCADE"); err != nil {
			t.Errorf("test schema cleanup failed: %v", err)
		}
		admin.Close()
	})
	database.Reconnect(t)
	if applyMigrations {
		provider, err := migrations.NewProvider(database.DB)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := provider.Up(ctx); err != nil {
			t.Fatal(err)
		}
	}
	return database
}

func (d *Database) Reconnect(t testing.TB) {
	t.Helper()
	if d.DB != nil {
		if err := d.DB.Close(); err != nil {
			t.Fatal(err)
		}
	}
	d.DB = stdlib.OpenDB(*d.config)
	d.DB.SetMaxOpenConns(4)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := d.DB.PingContext(ctx); err != nil {
		t.Fatal(err)
	}
}
