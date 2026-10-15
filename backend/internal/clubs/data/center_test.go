package data_test

import (
	"context"
	"database/sql"
	"fmt"
	"testing"

	clubapp "futcareer/backend/internal/clubs/application"
	clubdata "futcareer/backend/internal/clubs/data"
	leagueapp "futcareer/backend/internal/leagues/application"
	leaguedata "futcareer/backend/internal/leagues/data"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func club(t *testing.T, db *sql.DB, n int, name string) string {
	t.Helper()
	id := fmt.Sprintf("%032x", n)
	if _, err := db.Exec(`INSERT INTO users(id,full_name,email,password_hash,role,city,created_at,adult_confirmed,active) VALUES($1,$2,$3,'hash','club','Ankara',now(),true,true)`, id, name, id+"@example.com"); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO clubs(user_id,updated_at) VALUES($1,now())`, id); err != nil {
		t.Fatal(err)
	}
	return id
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestClubCenterSummarizesLeagueAndWork(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	me := club(t, db, 701, "Merkez FK")
	rival := club(t, db, 702, "Rakip SK")
	league := fmt.Sprintf("%032x", 703)
	if _, err := db.Exec(`INSERT INTO leagues(id,name,season,status) VALUES($1,'Ankara Ligi','2026-27','active')`, league); err != nil {
		t.Fatal(err)
	}
	myTeam, rivalTeam := fmt.Sprintf("%032x", 704), fmt.Sprintf("%032x", 705)
	for _, row := range []struct{ id, club string }{{myTeam, me}, {rivalTeam, rival}} {
		if _, err := db.Exec(`INSERT INTO league_teams(id,league_id,club_user_id) VALUES($1,$2,$3)`, row.id, league, row.club); err != nil {
			t.Fatal(err)
		}
	}
	// One played win for us (round 1) and one unplayed fixture (round 2).
	if _, err := db.Exec(`INSERT INTO league_matches(id,league_id,round,home_team_id,away_team_id,home_goals,away_goals) VALUES($1,$2,1,$3,$4,3,1)`, fmt.Sprintf("%032x", 706), league, myTeam, rivalTeam); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO league_matches(id,league_id,round,home_team_id,away_team_id) VALUES($1,$2,2,$3,$4)`, fmt.Sprintf("%032x", 707), league, rivalTeam, myTeam); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO team_join_requests(id,player_id,club_user_id,status) VALUES($1,$2,$3,'pending')`, fmt.Sprintf("%032x", 708), me, me); err != nil {
		t.Fatal(err)
	}

	svc := clubapp.New(clubdata.New(db), leagueapp.New(leaguedata.New(db)))
	center, err := svc.Center(ctx, me)
	if err != nil {
		t.Fatal(err)
	}
	if center.CompletenessPercent != 0 || len(center.MissingFields) != 7 {
		t.Fatalf("empty profile completeness: %+v", center)
	}
	if center.PendingApplications != 1 || len(center.Leagues) != 1 {
		t.Fatalf("center counts/leagues: %+v", center)
	}
	view := center.Leagues[0]
	if view.LeagueName != "Ankara Ligi" || view.Position != 1 || view.Points != 3 || view.Wins != 1 || view.Played != 1 {
		t.Fatalf("standing: %+v", view)
	}
	if len(view.Recent) != 1 || view.Recent[0].Result != "win" || view.Recent[0].OpponentName != "Rakip SK" {
		t.Fatalf("recent: %+v", view.Recent)
	}
	if len(view.Upcoming) != 1 || view.Upcoming[0].OpponentName != "Rakip SK" {
		t.Fatalf("upcoming: %+v", view.Upcoming)
	}

	other, err := svc.Center(ctx, rival)
	if err != nil || len(other.Leagues) != 1 || other.PendingApplications != 0 {
		t.Fatalf("rival view: %+v %v", other, err)
	}
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestAdminOverviewShowsClubNewsApplicationsAndLeague(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	me := club(t, db, 711, "Yönetim FK")
	league := fmt.Sprintf("%032x", 712)
	if _, err := db.Exec(`INSERT INTO leagues(id,name,season,status) VALUES($1,'Genel Lig','2026-27','active')`, league); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO league_teams(id,league_id,club_user_id) VALUES($1,$2,$3)`, fmt.Sprintf("%032x", 713), league, me); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO news_articles(id,title,summary,body,published,author_user_id,review_status) VALUES($1,'Bekleyen haber','Özet','Metin metin',false,$2,'pending')`, fmt.Sprintf("%032x", 714), me); err != nil {
		t.Fatal(err)
	}
	player := fmt.Sprintf("%032x", 715)
	if _, err := db.Exec(`INSERT INTO users(id,full_name,email,password_hash,role,city,created_at,adult_confirmed,active) VALUES($1,'Oyuncu Ali',$2,'hash','player','Ankara',now(),true,true)`, player, player+"@example.com"); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO team_join_requests(id,player_id,club_user_id,status) VALUES($1,$2,$3,'pending')`, fmt.Sprintf("%032x", 716), player, me); err != nil {
		t.Fatal(err)
	}
	svc := clubapp.New(clubdata.New(db), leagueapp.New(leaguedata.New(db)))
	out, err := svc.Overview(ctx, me)
	if err != nil {
		t.Fatal(err)
	}
	if out.Email != me+"@example.com" || !out.Active || out.Profile.Name != "Yönetim FK" {
		t.Fatalf("account: %+v", out)
	}
	if len(out.News) != 1 || out.News[0].ReviewStatus != "pending" || out.News[0].Published {
		t.Fatalf("news: %+v", out.News)
	}
	if len(out.Applications) != 1 || out.Applications[0].PlayerName != "Oyuncu Ali" {
		t.Fatalf("applications: %+v", out.Applications)
	}
	if len(out.Leagues) != 1 || out.Leagues[0].LeagueName != "Genel Lig" {
		t.Fatalf("leagues: %+v", out.Leagues)
	}
}
