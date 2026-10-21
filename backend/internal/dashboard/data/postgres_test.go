package data_test

import (
	"context"
	"testing"
	"time"

	"futcareer/backend/internal/dashboard/application"
	"futcareer/backend/internal/dashboard/data"
	"futcareer/backend/internal/testsupport/testpostgres"
)

// Requires TEST_DATABASE_URL; skipped otherwise. Every query of the page runs
// against the real schema and the numbers follow the rows.
func TestDashboardSummarisesEverySection(t *testing.T) {
	db := testpostgres.New(t).DB
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := db.Exec(query, args...); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
	for i, role := range []string{"player", "player", "coach", "club"} {
		id := "0000000000000000000000000000000" + string(rune('a'+i))
		exec(`INSERT INTO users(id,full_name,email,password_hash,role,city,created_at,username) VALUES($1,$2,$3,'x',$4,'Ankara',now()-interval '1 day',NULLIF($5,''))`,
			id, "Kişi "+role, id+"@example.com", role, map[bool]string{true: "kulup.a", false: ""}[role == "club"])
		if role == "player" {
			exec(`INSERT INTO player_profiles(user_id,availability,discoverable,updated_at,football_type,license_status,position) VALUES($1,'not_available',false,now(),'amateur','licensed','Santrfor')`, id)
		}
		if role == "club" {
			exec(`INSERT INTO clubs(user_id,updated_at) VALUES($1,now())`, id)
		}
	}
	exec(`INSERT INTO social_posts(id,author_id,body) VALUES('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','0000000000000000000000000000000a','Merhaba')`)
	exec(`INSERT INTO game_daily_plays(user_id,game,day,plays) VALUES('0000000000000000000000000000000a','penalty',(now() AT TIME ZONE 'Europe/Istanbul')::date,3)`)

	out, err := application.New(data.New(db)).Dashboard(context.Background(), 7)
	if err != nil {
		t.Fatal(err)
	}
	if out.Days != 7 || len(out.Daily) < 7 || len(out.Daily) > 8 {
		t.Fatalf("window: %d days, %d points", out.Days, len(out.Daily))
	}
	if out.KPIs.Users != 4 || out.KPIs.NewUsers != 4 || out.KPIs.Posts != 1 || out.KPIs.GamePlays != 3 {
		t.Fatalf("kpis: %+v", out.KPIs)
	}
	if out.Modules.Users.Players != 2 || out.Modules.Clubs.Total != 1 || out.Modules.Social.Posts != 1 {
		t.Fatalf("modules: %+v", out.Modules)
	}
	signups, plays := 0, 0
	for _, d := range out.Daily {
		signups += d.Players + d.Coaches + d.Clubs
		plays += d.GamePlays
	}
	if signups != 4 || plays != 3 {
		t.Fatalf("daily series: signups %d plays %d", signups, plays)
	}
	if len(out.Roles) != 3 || len(out.FootballTypes) != 1 || out.Positions[0].Key != "Santrfor" || out.Games[0].Key != "penalty" || len(out.RecentUsers) != 4 {
		t.Fatalf("slices: %+v %+v %+v %+v", out.Roles, out.FootballTypes, out.Positions, out.Games)
	}
	if out.GeneratedAt.After(time.Now().Add(time.Minute)) {
		t.Fatal("generatedAt in the future")
	}
}
