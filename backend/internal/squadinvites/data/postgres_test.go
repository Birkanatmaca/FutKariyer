package data_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"

	"futcareer/backend/internal/squadinvites/application"
	"futcareer/backend/internal/squadinvites/data"
	"futcareer/backend/internal/squadinvites/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func account(t *testing.T, db *sql.DB, n int, role string, discoverable bool) string {
	t.Helper()
	id := fmt.Sprintf("%032x", n)
	var email, username any
	if role == "player" {
		email = id + "@example.com"
	} else {
		username = "u" + id[24:]
	}
	if _, err := db.Exec(`INSERT INTO users(id,full_name,email,username,password_hash,role,city,created_at,adult_confirmed,active,verified) VALUES($1,$2,$3,$4,'hash',$5,'Ankara',now(),true,true,$6)`, id, "Oyuncu "+fmt.Sprint(n), email, username, role, role == "club"); err != nil {
		t.Fatal(err)
	}
	if role == "player" {
		if _, err := db.Exec(`INSERT INTO player_profiles(user_id,availability,discoverable,updated_at) VALUES($1,'seeking_team',$2,now())`, id, discoverable); err != nil {
			t.Fatal(err)
		}
	} else if _, err := db.Exec(`INSERT INTO clubs(user_id,football_type,updated_at) VALUES($1,'halisaha',now())`, id); err != nil {
		t.Fatal(err)
	}
	return id
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestClubInvitesPlayerIntoSquad(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	svc := application.New(data.New(db))
	club := account(t, db, 3101, "club", false)
	player := account(t, db, 3102, "player", true)
	hidden := account(t, db, 3103, "player", false)
	blocker := account(t, db, 3104, "player", true)
	if _, err := db.Exec(`INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, blocker, club); err != nil {
		t.Fatal(err)
	}

	cands, err := svc.Candidates(ctx, club, "oyuncu")
	if err != nil || len(cands) != 1 || cands[0].ID != player {
		t.Fatalf("only the discoverable, unblocked player is a candidate: %+v %v", cands, err)
	}
	for _, id := range []string{hidden, blocker} {
		if _, err := svc.Invite(ctx, club, id, ""); !errors.Is(err, domain.ErrNotInvitable) {
			t.Fatalf("invited %s: %v", id, err)
		}
	}
	inv, err := svc.Invite(ctx, club, player, "Cumartesi maçımız var")
	if err != nil || inv.Status != "pending" || inv.ClubName == "" {
		t.Fatalf("invite: %+v %v", inv, err)
	}
	if _, err := svc.Invite(ctx, club, player, ""); !errors.Is(err, domain.ErrNotInvitable) {
		t.Fatal("second open invitation accepted")
	}
	mine, err := svc.PlayerInvites(ctx, player)
	if err != nil || len(mine) != 1 {
		t.Fatalf("player invites: %+v %v", mine, err)
	}
	if _, err := svc.Respond(ctx, hidden, inv.ID, "accept"); !errors.Is(err, domain.ErrNotFound) {
		t.Fatal("another player answered the invitation")
	}
	acc, err := svc.Respond(ctx, player, inv.ID, "accept")
	if err != nil || acc.Status != "accepted" {
		t.Fatalf("accept: %+v %v", acc, err)
	}
	var members int
	if err := db.QueryRow(`SELECT count(*) FROM club_squad_members WHERE club_user_id=$1 AND player_id=$2 AND left_at IS NULL`, club, player).Scan(&members); err != nil || members != 1 {
		t.Fatalf("player should be in the squad: %d %v", members, err)
	}
	if _, err := svc.Respond(ctx, player, inv.ID, "decline"); !errors.Is(err, domain.ErrInvalidState) {
		t.Fatal("answered invitation answered again")
	}
	var notes int
	if err := db.QueryRow(`SELECT count(*) FROM notifications WHERE kind='squad_invite'`).Scan(&notes); err != nil || notes != 2 {
		t.Fatalf("invite and answer should notify: %d %v", notes, err)
	}
	if cands, _ := svc.Candidates(ctx, club, "oyuncu"); len(cands) != 0 {
		t.Fatalf("squad member still a candidate: %+v", cands)
	}

	// A player who left can be invited back; the club can cancel.
	if _, err := db.Exec(`UPDATE club_squad_members SET left_at=clock_timestamp() WHERE club_user_id=$1`, club); err != nil {
		t.Fatal(err)
	}
	back, err := svc.Invite(ctx, club, player, "")
	if err != nil {
		t.Fatal(err)
	}
	if out, err := svc.Cancel(ctx, club, back.ID); err != nil || out.Status != "cancelled" {
		t.Fatalf("cancel: %+v %v", out, err)
	}
	if _, err := svc.Respond(ctx, player, back.ID, "accept"); !errors.Is(err, domain.ErrInvalidState) {
		t.Fatal("cancelled invitation accepted")
	}
	back, _ = svc.Invite(ctx, club, player, "")
	if _, err := svc.Respond(ctx, player, back.ID, "accept"); err != nil {
		t.Fatalf("rejoin: %v", err)
	}
	if err := db.QueryRow(`SELECT count(*) FROM club_squad_members WHERE club_user_id=$1 AND left_at IS NULL`, club).Scan(&members); err != nil || members != 1 {
		t.Fatalf("rejoined player should be active again: %d", members)
	}
}
