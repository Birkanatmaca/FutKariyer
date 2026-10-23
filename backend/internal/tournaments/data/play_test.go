package data_test

import (
	"context"
	"errors"
	"testing"

	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
	"futcareer/backend/internal/tournaments/application"
	"futcareer/backend/internal/tournaments/data"
	"futcareer/backend/internal/tournaments/domain"
)

func goals(n int) *int { return &n }

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestHalisahaLeagueInvitesFixtureScoresAndStandings(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	svc := application.New(data.New(db))

	// Administrators open organizer accounts; they start verified.
	org, err := svc.CreateOrganizer(ctx, application.OrganizerInput{FullName: "Golden Lig", Username: "goldenlig", Password: "guclu-sifre-123"})
	if err != nil || !org.Verified || !org.Active {
		t.Fatalf("create organizer: %+v %v", org, err)
	}
	if _, err := svc.CreateOrganizer(ctx, application.OrganizerInput{FullName: "Kopya", Username: "goldenlig", Password: "guclu-sifre-123"}); !errors.Is(err, authdomain.ErrUsernameExists) {
		t.Fatalf("duplicate username: %v", err)
	}
	other := account(t, db, 2101, "organizer", "", true)
	clubA := account(t, db, 2102, "club", "halisaha", true)
	clubB := account(t, db, 2103, "club", "halisaha", true)
	clubC := account(t, db, 2104, "club", "halisaha", true)
	amateur := account(t, db, 2105, "club", "amateur", true)
	player := account(t, db, 2106, "player", "", false)
	if _, err := db.Exec(`INSERT INTO club_squad_members(club_user_id,player_id) VALUES($1,$2)`, clubB, player); err != nil {
		t.Fatal(err)
	}

	tour, _, err := svc.Create(ctx, org.ID, application.Input{Name: "Golden Lig Ankara", Format: "halisaha", EligibleTypes: []string{"halisaha"}, StartsOn: day(10), EndsOn: day(60), ApplicationDeadline: day(5), TeamCapacity: 3})
	if err != nil {
		t.Fatal(err)
	}

	// Application path: club A applies, organizer accepts.
	entryA, err := svc.Enter(ctx, clubA, tour.ID, "", nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Decide(ctx, org.ID, tour.ID, entryA.ID, "accept"); err != nil {
		t.Fatal(err)
	}

	// Invitation path.
	cands, err := svc.Candidates(ctx, org.ID, tour.ID, "hesap")
	if err != nil || len(cands) != 2 {
		t.Fatalf("candidates should be B and C (eligible, not entered): %+v %v", cands, err)
	}
	if _, err := svc.Candidates(ctx, other, tour.ID, "hesap"); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("another organizer searched candidates: %v", err)
	}
	if _, err := svc.Invite(ctx, org.ID, tour.ID, amateur, ""); !errors.Is(err, domain.ErrNotEligible) {
		t.Fatalf("ineligible club invited: %v", err)
	}
	if _, err := svc.Invite(ctx, org.ID, tour.ID, clubA, ""); !errors.Is(err, domain.ErrNotInvitable) {
		t.Fatalf("participant invited again: %v", err)
	}
	invB, err := svc.Invite(ctx, org.ID, tour.ID, clubB, "Bekleriz")
	if err != nil || invB.Status != "invited" {
		t.Fatalf("invite B: %+v %v", invB, err)
	}
	invC, err := svc.Invite(ctx, org.ID, tour.ID, clubC, "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Enter(ctx, clubB, tour.ID, "", nil); !errors.Is(err, domain.ErrDuplicate) {
		t.Fatalf("invited club applied over its invitation: %v", err)
	}
	if _, err := svc.RespondInvite(ctx, clubA, invB.ID, "accept", nil); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("another club answered B's invitation: %v", err)
	}
	accB, err := svc.RespondInvite(ctx, clubB, invB.ID, "accept", []string{player})
	if err != nil || accB.Status != "accepted" || len(accB.Players) != 1 {
		t.Fatalf("accept invite: %+v %v", accB, err)
	}
	if dec, err := svc.RespondInvite(ctx, clubC, invC.ID, "decline", nil); err != nil || dec.Status != "declined" {
		t.Fatalf("decline: %+v %v", dec, err)
	}
	var orgNotes int
	if err := db.QueryRow(`SELECT count(*) FROM notifications WHERE recipient_id=$1 AND title IN ('Davet kabul edildi','Davet reddedildi')`, org.ID).Scan(&orgNotes); err != nil || orgNotes != 2 {
		t.Fatalf("organizer should hear both answers, got %d %v", orgNotes, err)
	}
	// A declined club can be invited again, and the organizer can take it back.
	again, err := svc.Invite(ctx, org.ID, tour.ID, clubC, "")
	if err != nil || again.ID != invC.ID || again.Status != "invited" {
		t.Fatalf("re-invite: %+v %v", again, err)
	}
	if out, err := svc.CancelInvite(ctx, org.ID, tour.ID, again.ID); err != nil || out.Status != "withdrawn" {
		t.Fatalf("cancel invite: %+v %v", out, err)
	}

	// Fixture: two accepted teams, double round robin.
	if _, err := svc.GenerateFixture(ctx, other, tour.ID, 2); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("another organizer generated a fixture: %v", err)
	}
	table, err := svc.GenerateFixture(ctx, org.ID, tour.ID, 2)
	if err != nil || len(table.Matches) != 2 || len(table.Teams) != 2 {
		t.Fatalf("fixture: %+v %v", table, err)
	}
	if _, err := svc.GenerateFixture(ctx, org.ID, tour.ID, 1); !errors.Is(err, domain.ErrFixtureExists) {
		t.Fatalf("fixture replaced: %v", err)
	}
	m := table.Matches[0]
	in := application.MatchInput{Round: m.Round, HomeEntryID: m.HomeEntryID, AwayEntryID: m.AwayEntryID, HomeGoals: goals(5)}
	if _, err := svc.SaveMatch(ctx, org.ID, tour.ID, m.ID, in); !errors.As(err, new(auth.ValidationError)) {
		t.Fatal("half a score accepted")
	}
	in.AwayGoals = goals(3)
	scored, err := svc.SaveMatch(ctx, org.ID, tour.ID, m.ID, in)
	if err != nil || *scored.HomeGoals != 5 || *scored.AwayGoals != 3 {
		t.Fatalf("score: %+v %v", scored, err)
	}
	if _, err := svc.SaveMatch(ctx, org.ID, tour.ID, "", application.MatchInput{Round: 3, HomeEntryID: m.HomeEntryID, AwayEntryID: invC.ID}); !errors.Is(err, domain.ErrNotTeam) {
		t.Fatalf("match with a non-participant: %v", err)
	}
	extra, err := svc.SaveMatch(ctx, org.ID, tour.ID, "", application.MatchInput{Round: 3, HomeEntryID: m.AwayEntryID, AwayEntryID: m.HomeEntryID, Venue: "Saha 2", HomeGoals: goals(2), AwayGoals: goals(2)})
	if err != nil {
		t.Fatal(err)
	}

	public, err := svc.Table(ctx, tour.ID)
	if err != nil || len(public.Standings) != 2 || len(public.Matches) != 3 {
		t.Fatalf("table: %+v %v", public, err)
	}
	top := public.Standings[0]
	if top.EntryID != m.HomeEntryID || top.Points != 4 || top.Played != 2 || top.Wins != 1 || top.Draws != 1 || top.GoalsFor != 7 || top.GoalsAgainst != 5 || top.GoalDiff != 2 {
		t.Fatalf("leader: %+v", top)
	}
	if second := public.Standings[1]; second.Points != 1 || second.Losses != 1 || second.Position != 2 {
		t.Fatalf("second: %+v", second)
	}

	// The player in club B's roster sees the tournament with the next match.
	mine, err := svc.PlayerTournaments(ctx, player)
	if err != nil || len(mine) != 1 || mine[0].EntryID != accB.ID || mine[0].Teams != 2 || mine[0].Position == 0 || mine[0].NextMatch == nil || mine[0].NextMatch.HomeGoals != nil {
		t.Fatalf("player tournaments: %+v %v", mine, err)
	}
	if clubs, err := svc.ClubTournaments(ctx, clubB); err != nil || len(clubs) != 1 || clubs[0].EntryID != accB.ID {
		t.Fatalf("club tournaments: %+v %v", clubs, err)
	}
	if none, err := svc.PlayerTournaments(ctx, other); err != nil || len(none) != 0 {
		t.Fatalf("someone outside the roster: %+v %v", none, err)
	}

	// Clearing removes only unplayed matches.
	cleared, err := svc.ClearFixture(ctx, org.ID, tour.ID)
	if err != nil || len(cleared.Matches) != 2 {
		t.Fatalf("clear: %d %v", len(cleared.Matches), err)
	}
	if err := svc.DeleteMatch(ctx, org.ID, tour.ID, extra.ID); err != nil {
		t.Fatal(err)
	}

	// Listing: halı saha tournaments, including running ones.
	page, err := svc.List(ctx, "halisaha", true, 1)
	if err != nil || page.Total != 1 || page.Items[0].ID != tour.ID {
		t.Fatalf("halisaha list: %+v %v", page, err)
	}
	if page, err := svc.List(ctx, "eleven_a_side", true, 1); err != nil || page.Total != 0 {
		t.Fatalf("format filter: %+v %v", page, err)
	}

	// A finished tournament's results are locked.
	if _, err := svc.SetStatus(ctx, org.ID, tour.ID, "closed"); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SetStatus(ctx, org.ID, tour.ID, "finished"); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SaveMatch(ctx, org.ID, tour.ID, m.ID, in); !errors.Is(err, domain.ErrInvalidState) {
		t.Fatalf("finished tournament score changed: %v", err)
	}
	orgs, err := svc.Organizers(ctx, 1)
	if err != nil || orgs.Total != 2 {
		t.Fatalf("organizers: %+v %v", orgs, err)
	}
}
