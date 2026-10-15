package data_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"

	clubdata "futcareer/backend/internal/clubs/data"
	clubdomain "futcareer/backend/internal/clubs/domain"
	"futcareer/backend/internal/listings/application"
	"futcareer/backend/internal/listings/data"
	"futcareer/backend/internal/listings/domain"
	teamapp "futcareer/backend/internal/teams/application"
	teamdata "futcareer/backend/internal/teams/data"
	teamdomain "futcareer/backend/internal/teams/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func account(t *testing.T, db *sql.DB, n int, role, footballType string) string {
	t.Helper()
	id := fmt.Sprintf("%032x", n)
	if _, err := db.Exec(`INSERT INTO users(id,full_name,email,password_hash,role,city,created_at,adult_confirmed,active,verified) VALUES($1,$2,$3,'hash',$4,'Ankara',now(),true,true,$5)`, id, "Hesap "+fmt.Sprint(n), id+"@example.com", role, role != "player"); err != nil {
		t.Fatal(err)
	}
	switch role {
	case "player":
		if _, err := db.Exec(`INSERT INTO player_profiles(user_id,availability,discoverable,football_type,updated_at) VALUES($1,'seeking_team',true,$2,now())`, id, footballType); err != nil {
			t.Fatal(err)
		}
	case "club":
		if _, err := db.Exec(`INSERT INTO clubs(user_id,football_type,updated_at) VALUES($1,$2,now())`, id, footballType); err != nil {
			t.Fatal(err)
		}
	}
	return id
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestListingApplicationBecomesSquadMembership(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	teams := teamdata.New(db)
	svc := application.New(data.New(db), teamapp.New(teams))
	club := account(t, db, 1001, "club", "halisaha")
	matching := account(t, db, 1002, "player", "halisaha")
	account(t, db, 1003, "player", "amateur")

	listing, notified, err := svc.Create(ctx, club, application.Input{Title: "Kaleci arıyoruz", Position: "Kaleci", Description: "Hafta içi akşam maçları"})
	if err != nil || notified != 1 || listing.Status != "open" || listing.FootballType != "halisaha" {
		t.Fatalf("create: %+v notified=%d %v", listing, notified, err)
	}

	request, quota, err := svc.Apply(ctx, matching, listing.ID)
	if err != nil || request.Status != "pending" || quota.Used != 1 {
		t.Fatalf("apply: %+v %+v %v", request, quota, err)
	}
	var linked string
	if err := db.QueryRow(`SELECT COALESCE(listing_id,'') FROM team_join_requests WHERE id=$1`, request.ID).Scan(&linked); err != nil || linked != listing.ID {
		t.Fatal("team application not linked to listing")
	}
	if _, _, err := svc.Apply(ctx, matching, listing.ID); !errors.Is(err, teamdomain.ErrDuplicate) {
		t.Fatalf("second application to the same club: %v", err)
	}
	mine, err := svc.Mine(ctx, club)
	if err != nil || len(mine) != 1 || *mine[0].Applications != 1 {
		t.Fatalf("club listings: %+v %v", mine, err)
	}

	if _, err := teams.DecideRequest(ctx, club, request.ID, "accepted"); err != nil {
		t.Fatal(err)
	}
	clubs := clubdata.New(db)
	squad, err := clubs.Squad(ctx, club)
	if err != nil || len(squad) != 1 || squad[0].PlayerID != matching {
		t.Fatalf("squad after acceptance: %+v %v", squad, err)
	}
	memberships, err := clubs.Memberships(ctx, matching)
	if err != nil || len(memberships) != 1 || memberships[0].ClubID != club {
		t.Fatalf("memberships: %+v %v", memberships, err)
	}
	if err := clubs.RemoveMember(ctx, club, matching); err != nil {
		t.Fatal(err)
	}
	if err := clubs.RemoveMember(ctx, club, matching); !errors.Is(err, clubdomain.ErrNotMember) {
		t.Fatal("removing a former member should report not a member")
	}

	if _, err := svc.Close(ctx, club, listing.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Get(ctx, listing.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatal("closed listing still public")
	}
	for i := 0; i < domain.MaxOpenPerClub; i++ {
		if _, _, err := svc.Create(ctx, club, application.Input{Title: fmt.Sprintf("İlan %d", i)}); err != nil {
			t.Fatal(err)
		}
	}
	if _, _, err := svc.Create(ctx, club, application.Input{Title: "Fazla ilan"}); !errors.Is(err, domain.ErrTooManyOpen) {
		t.Fatalf("open listing cap not enforced: %v", err)
	}
}
