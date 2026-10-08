package migrations_test

import (
	"context"
	"database/sql"
	"testing"

	"futcareer/backend/internal/testsupport/testpostgres"
	"futcareer/backend/migrations"
)

func TestMigrationLifecycleAndSchemaGuard(t *testing.T) {
	database := testpostgres.NewUnmigrated(t)
	ctx := context.Background()
	if err := migrations.CheckCurrent(ctx, database.DB); err == nil {
		t.Fatal("an empty database was accepted by the API schema guard")
	}
	var table sql.NullString
	if err := database.DB.QueryRowContext(ctx, "SELECT to_regclass('goose_db_version')::text").Scan(&table); err != nil || table.Valid {
		t.Fatalf("schema guard modified the database: %v", err)
	}
	provider, err := migrations.NewProvider(database.DB)
	if err != nil {
		t.Fatal(err)
	}
	results, err := provider.Up(ctx)
	if err != nil || len(results) != 5 {
		t.Fatalf("initial migrations: count=%d error=%v", len(results), err)
	}
	if err := migrations.CheckCurrent(ctx, database.DB); err != nil {
		t.Fatal(err)
	}
	results, err = provider.Up(ctx)
	if err != nil || len(results) != 0 {
		t.Fatalf("repeat up must not reapply migrations: count=%d error=%v", len(results), err)
	}
	if _, err := provider.Down(ctx); err != nil {
		t.Fatal(err)
	}
	if err := migrations.CheckCurrent(ctx, database.DB); err == nil {
		t.Fatal("outdated database was accepted by the schema guard")
	}
	if _, err := provider.Down(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := provider.Down(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := provider.Down(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := provider.Down(ctx); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"users", "sessions", "player_profiles", "clubs"} {
		if err := database.DB.QueryRowContext(ctx, "SELECT to_regclass($1)::text", name).Scan(&table); err != nil || table.Valid {
			t.Fatalf("down did not remove %s: %v", name, err)
		}
	}
	results, err = provider.Up(ctx)
	if err != nil || len(results) != 5 {
		t.Fatalf("migrations after rollback: count=%d error=%v", len(results), err)
	}
	if err := migrations.CheckCurrent(ctx, database.DB); err != nil {
		t.Fatal(err)
	}
}
