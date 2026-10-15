package data_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"
	"time"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/testsupport/testpostgres"
	"futcareer/backend/internal/tournaments/application"
	"futcareer/backend/internal/tournaments/data"
	"futcareer/backend/internal/tournaments/domain"
)

func account(t *testing.T, db *sql.DB, n int, role, footballType string, verified bool) string {
	t.Helper()
	id := fmt.Sprintf("%032x", n)
	var email any
	if role == "player" {
		email = id + "@example.com"
	}
	if _, err := db.Exec(`INSERT INTO users(id,full_name,email,username,password_hash,role,city,created_at,adult_confirmed,active,verified) VALUES($1,$2,$3,$4,'hash',$5,'Ankara',now(),true,true,$6)`, id, "Hesap "+fmt.Sprint(n), email, "u"+id[24:], role, verified); err != nil {
		t.Fatal(err)
	}
	switch role {
	case "player":
		if _, err := db.Exec(`INSERT INTO player_profiles(user_id,availability,updated_at) VALUES($1,'seeking_team',now())`, id); err != nil {
			t.Fatal(err)
		}
	case "club":
		if _, err := db.Exec(`INSERT INTO clubs(user_id,football_type,updated_at) VALUES($1,$2,now())`, id, footballType); err != nil {
			t.Fatal(err)
		}
	}
	return id
}

func day(offset int) string { return time.Now().AddDate(0, 0, offset).Format(time.DateOnly) }

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestTournamentMatchesEligibleClubsWithinCapacity(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	svc := application.New(data.New(db))
	unverified := account(t, db, 1101, "organizer", "", false)
	organizer := account(t, db, 1102, "organizer", "", true)
	clubA := account(t, db, 1103, "club", "halisaha", true)
	clubB := account(t, db, 1104, "club", "halisaha", true)
	clubC := account(t, db, 1105, "club", "halisaha", true)
	amateur := account(t, db, 1106, "club", "amateur", true)
	player := account(t, db, 1107, "player", "", false)
	outsider := account(t, db, 1108, "player", "", false)
	if _, err := db.Exec(`INSERT INTO club_squad_members(club_user_id,player_id) VALUES($1,$2)`, clubA, player); err != nil {
		t.Fatal(err)
	}

	in := application.Input{Name: "Ankara Halı Saha Kupası", Format: "halisaha", EligibleTypes: []string{"halisaha"}, District: "Çankaya", StartsOn: day(30), EndsOn: day(32), ApplicationDeadline: day(20), TeamCapacity: 2}
	if _, _, err := svc.Create(ctx, unverified, in); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("unverified organizer created a tournament: %v", err)
	}
	past := in
	past.StartsOn = day(-1)
	if _, _, err := svc.Create(ctx, organizer, past); !errors.As(err, new(auth.ValidationError)) {
		t.Fatal("tournament in the past accepted")
	}
	tour, notified, err := svc.Create(ctx, organizer, in)
	if err != nil || notified != 3 || tour.Status != "open" || tour.EligibleTypes[0] != "halisaha" {
		t.Fatalf("create: %+v notified=%d %v", tour, notified, err)
	}

	if _, err := svc.Enter(ctx, amateur, tour.ID, "", nil); !errors.Is(err, domain.ErrNotEligible) {
		t.Fatalf("ineligible club entered: %v", err)
	}
	entryA, err := svc.Enter(ctx, clubA, tour.ID, "Hazırız", []string{player})
	if err != nil || entryA.Status != "pending" || len(entryA.Players) != 1 {
		t.Fatalf("enter A: %+v %v", entryA, err)
	}
	if _, err := svc.Enter(ctx, clubA, tour.ID, "", nil); !errors.Is(err, domain.ErrDuplicate) {
		t.Fatal("duplicate entry accepted")
	}
	if _, err := svc.Enter(ctx, clubB, tour.ID, "", []string{outsider}); !errors.Is(err, domain.ErrNotInSquad) {
		t.Fatalf("roster outside squad accepted: %v", err)
	}
	entryB, err := svc.Enter(ctx, clubB, tour.ID, "", nil)
	if err != nil {
		t.Fatal(err)
	}
	entryC, err := svc.Enter(ctx, clubC, tour.ID, "", nil)
	if err != nil {
		t.Fatal(err)
	}
	var orgNotes int
	if err := db.QueryRow(`SELECT count(*) FROM notifications WHERE recipient_id=$1 AND kind='tournament'`, organizer).Scan(&orgNotes); err != nil || orgNotes != 3 {
		t.Fatalf("organizer should be notified of each entry, got %d", orgNotes)
	}

	for _, e := range []domain.Entry{entryA, entryB} {
		if out, err := svc.Decide(ctx, organizer, tour.ID, e.ID, "accept"); err != nil || out.Status != "accepted" {
			t.Fatalf("accept: %+v %v", out, err)
		}
	}
	if _, err := svc.Decide(ctx, organizer, tour.ID, entryC.ID, "accept"); !errors.Is(err, domain.ErrFull) {
		t.Fatalf("capacity not enforced: %v", err)
	}
	list, err := svc.Entries(ctx, organizer, tour.ID)
	if err != nil || len(list) != 3 {
		t.Fatalf("entries: %d %v", len(list), err)
	}

	if out, err := svc.Withdraw(ctx, clubA, entryA.ID); err != nil || out.Status != "withdrawn" {
		t.Fatalf("withdraw: %+v %v", out, err)
	}
	again, err := svc.Enter(ctx, clubA, tour.ID, "Tekrar", []string{player})
	if err != nil || again.ID != entryA.ID || again.Status != "pending" {
		t.Fatalf("re-enter after withdraw: %+v %v", again, err)
	}

	if _, err := svc.SetStatus(ctx, organizer, tour.ID, "closed"); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Enter(ctx, amateur, tour.ID, "", nil); !errors.Is(err, domain.ErrClosed) {
		t.Fatalf("closed tournament took an entry: %v", err)
	}
	if _, err := svc.SetStatus(ctx, organizer, tour.ID, "cancelled"); err != nil {
		t.Fatal(err)
	}
	var cancelled int
	if err := db.QueryRow(`SELECT count(*) FROM notifications WHERE kind='tournament' AND title='Turnuva iptal edildi'`).Scan(&cancelled); err != nil || cancelled != 3 {
		t.Fatalf("pending and accepted entries should be told about cancellation, got %d", cancelled)
	}
	if _, err := svc.SetStatus(ctx, organizer, tour.ID, "open"); !errors.Is(err, domain.ErrInvalidState) {
		t.Fatal("cancelled tournament reopened")
	}
}
