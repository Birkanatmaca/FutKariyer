package data_test

import (
	"context"
	"database/sql"
	"fmt"
	"testing"

	clubapp "futcareer/backend/internal/clubs/application"
	clubdata "futcareer/backend/internal/clubs/data"
	footballdomain "futcareer/backend/internal/football/domain"
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

	svc := clubapp.New(clubdata.New(db), leagueapp.New(leaguedata.New(db)), nil)
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
	if view.Recent[0].OpponentID != rival || view.Recent[0].OpponentAvatarVersion != 0 {
		t.Fatalf("rival crest without a photo: %+v", view.Recent[0])
	}
	if _, err := db.Exec(`UPDATE users SET avatar_version=3 WHERE id=$1`, rival); err != nil {
		t.Fatal(err)
	}
	if again, err := svc.Center(ctx, me); err != nil || again.Leagues[0].Upcoming[0].OpponentAvatarVersion != 3 {
		t.Fatalf("rival crest version: %+v %v", again.Leagues, err)
	}
	full, err := svc.Leagues(ctx, me)
	if err != nil || len(full.Leagues) != 1 || full.TFFLinked {
		t.Fatalf("leagues: %+v %v", full, err)
	}
	if l := full.Leagues[0]; len(l.Matches) != 2 || l.Matches[1].OpponentAvatarVersion != 3 || len(l.Weeks) != 2 || l.CurrentWeek != 2 || !l.Weeks[0].Matches[0].Own {
		t.Fatalf("league detail: %+v", l)
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
	svc := clubapp.New(clubdata.New(db), leagueapp.New(leaguedata.New(db)), nil)
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

type ankaraStub struct{ table footballdomain.AnkaraTable }

func (s ankaraStub) Ankara(context.Context, string, string, string) (footballdomain.AnkaraTable, error) {
	return s.table, nil
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestClubTFFLinkPutsTheFederationGroupFirst(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	me := club(t, db, 721, "Barışspor")
	two := 2
	stub := ankaraStub{footballdomain.AnkaraTable{
		Seasons:   []footballdomain.Option{{ID: "20", Name: "2026-2027 Sezonu", Selected: true}},
		Leagues:   []footballdomain.Option{{ID: "1166", Name: "U14 Ligi", Selected: true}},
		Groups:    []footballdomain.Option{{ID: "1289", Name: "1. GRUP", Selected: true}},
		Standings: []footballdomain.StandingRow{{Rank: 1, Team: footballdomain.Team{Name: "BARIŞSPOR"}, Played: 1, Won: 1, Points: 3}, {Rank: 2, Team: footballdomain.Team{Name: "RAKİP SK"}, Played: 1, Lost: 1}},
		Weeks:     []footballdomain.AnkaraWeek{{Number: 1, Matches: []footballdomain.AnkaraMatch{{Date: "19 Eylül 2026 Cumartesi", Time: "12:00", Home: "RAKİP SK", Away: "BARIŞSPOR", HomeGoals: &two, AwayGoals: new(int)}}}},
	}}
	svc := clubapp.New(clubdata.New(db), leagueapp.New(leaguedata.New(db)), stub)
	profile, err := svc.SetTFF(ctx, me, clubapp.TFFInput{Season: "20", League: "1166", Group: "1289", Team: "BARIŞSPOR"})
	if err != nil || profile.TFF == nil || profile.TFF.Label != "2026-2027 Sezonu · U14 Ligi · 1. GRUP" {
		t.Fatalf("link: %+v %v", profile.TFF, err)
	}
	center, err := svc.Center(ctx, me)
	if err != nil || !center.TFFLinked || len(center.Leagues) != 1 || center.Leagues[0].Source != "tff" || center.Leagues[0].Position != 1 {
		t.Fatalf("center: %+v %v", center, err)
	}
	if r := center.Leagues[0].Recent; len(r) != 1 || r[0].Result != "loss" || r[0].IsHome {
		t.Fatalf("recent: %+v", r)
	}
	leagues, err := svc.Leagues(ctx, me)
	if err != nil || !leagues.TFFLinked || len(leagues.Leagues) != 1 || len(leagues.Leagues[0].Matches) != 1 || len(leagues.Leagues[0].Weeks) != 1 || len(leagues.Leagues[0].Standings) != 2 {
		t.Fatalf("leagues: %+v %v", leagues, err)
	}
	if profile, err = svc.ClearTFF(ctx, me); err != nil || profile.TFF != nil {
		t.Fatalf("clear: %+v %v", profile.TFF, err)
	}
	if center, err = svc.Center(ctx, me); err != nil || center.TFFLinked || len(center.Leagues) != 0 {
		t.Fatalf("center after clear: %+v %v", center, err)
	}
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestCoachTeamsShowTheClubLeagueAndOnlyPermittedWork(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	club1 := club(t, db, 731, "Barışspor")
	club2 := club(t, db, 732, "Davet FK")
	coach := fmt.Sprintf("%032x", 733)
	player := fmt.Sprintf("%032x", 734)
	for _, u := range []struct{ id, name, role string }{{coach, "Selim Kara", "coach"}, {player, "Emre Kaya", "player"}} {
		if _, err := db.Exec(`INSERT INTO users(id,full_name,email,password_hash,role,city,created_at,adult_confirmed,active) VALUES($1,$2,$3,'hash',$4,'Ankara',now(),true,true)`, u.id, u.name, u.id+"@example.com", u.role); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(`INSERT INTO club_staff(club_user_id,coach_user_id,status,role,permissions,joined_at) VALUES($1,$3,'active','head_coach','{squad}',now()),($2,$3,'invited','assistant','{}',NULL)`, club1, club2, coach); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO club_squad_members(club_user_id,player_id) VALUES($1,$2)`, club1, player); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO team_join_requests(id,player_id,club_user_id,status) VALUES($1,$2,$3,'pending')`, fmt.Sprintf("%032x", 735), player, club1); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`UPDATE clubs SET tff_season='20',tff_league='1166',tff_group='1289',tff_team='BARIŞSPOR',tff_label='U14' WHERE user_id=$1`, club1); err != nil {
		t.Fatal(err)
	}
	stub := ankaraStub{footballdomain.AnkaraTable{
		Leagues:   []footballdomain.Option{{ID: "1166", Name: "U14 Ligi", Selected: true}},
		Standings: []footballdomain.StandingRow{{Rank: 3, Team: footballdomain.Team{Name: "BARIŞSPOR"}, Points: 9}},
	}}
	svc := clubapp.New(clubdata.New(db), leagueapp.New(leaguedata.New(db)), stub)
	out, err := svc.CoachTeams(ctx, coach)
	if err != nil {
		t.Fatal(err)
	}
	if out.Invitations != 1 || len(out.Teams) != 1 {
		t.Fatalf("teams and invitations: %+v", out)
	}
	team := out.Teams[0]
	if team.ClubID != club1 || team.Role != "head_coach" || len(team.Permissions) != 1 || team.SquadCount != 1 || !team.TFFLinked {
		t.Fatalf("team: %+v", team)
	}
	if team.PendingApplications != 0 {
		t.Fatal("applications are counted only with the applications right")
	}
	if team.League == nil || team.League.Source != "tff" || team.League.Position != 3 {
		t.Fatalf("league: %+v", team.League)
	}
	if _, err := db.Exec(`UPDATE club_staff SET permissions='{squad,applications}' WHERE coach_user_id=$1 AND club_user_id=$2`, coach, club1); err != nil {
		t.Fatal(err)
	}
	if out, err = svc.CoachTeams(ctx, coach); err != nil || out.Teams[0].PendingApplications != 1 {
		t.Fatalf("with the right: %+v %v", out, err)
	}
	if none, err := svc.CoachTeams(ctx, player); err != nil || len(none.Teams) != 0 || none.Invitations != 0 {
		t.Fatalf("no staff places: %+v %v", none, err)
	}
}
