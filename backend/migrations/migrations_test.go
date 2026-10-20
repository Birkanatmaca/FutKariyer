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
	if err != nil || len(results) != 38 {
		t.Fatalf("initial migrations: count=%d error=%v", len(results), err)
	}
	if err := migrations.CheckCurrent(ctx, database.DB); err != nil {
		t.Fatal(err)
	}
	results, err = provider.Up(ctx)
	if err != nil || len(results) != 0 {
		t.Fatalf("repeat up must not reapply migrations: count=%d error=%v", len(results), err)
	}
	for i := 0; i < 38; i++ {
		if _, err := provider.Down(ctx); err != nil {
			t.Fatal(err)
		}
		if i == 0 && migrations.CheckCurrent(ctx, database.DB) == nil {
			t.Fatal("outdated database was accepted by the schema guard")
		}
	}
	for _, name := range []string{"users", "sessions", "player_profiles", "clubs", "content_images", "advertisements", "news_articles", "profile_views", "profile_follows", "leagues", "league_teams", "league_matches", "team_join_requests", "game_wallets", "football_guess_runs", "team_request_game_rewards", "penalty_shootouts", "team_request_penalty_rewards", "gifts", "user_gifts", "team_request_gift_rewards", "announcements", "connection_requests", "club_squad_members", "club_listings", "tournaments", "tournament_entries", "tournament_entry_players", "account_applications", "head_to_head_runs", "football_guess_seen", "pro_plans", "pro_memberships", "pro_periods", "store_sync_cursors", "user_blocks", "content_reports", "player_media", "push_devices", "game_daily_plays", "rating_seasons", "rating_points", "rating_tasks", "user_avatars", "player_watchlist"} {
		if err := database.DB.QueryRowContext(ctx, "SELECT to_regclass($1)::text", name).Scan(&table); err != nil || table.Valid {
			t.Fatalf("down did not remove %s: %v", name, err)
		}
	}
	results, err = provider.Up(ctx)
	if err != nil || len(results) != 38 {
		t.Fatalf("migrations after rollback: count=%d error=%v", len(results), err)
	}
	if err := migrations.CheckCurrent(ctx, database.DB); err != nil {
		t.Fatal(err)
	}
}
