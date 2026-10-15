package data_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"

	"futcareer/backend/internal/connections/application"
	"futcareer/backend/internal/connections/data"
	"futcareer/backend/internal/connections/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func user(t *testing.T, db *sql.DB, n int, role string, verified, discoverable bool) string {
	t.Helper()
	id := fmt.Sprintf("%032x", n)
	if _, err := db.Exec(`INSERT INTO users(id,full_name,email,password_hash,role,city,created_at,adult_confirmed,active,verified) VALUES($1,$2,$3,'hash',$4,'Ankara',now(),true,true,$5)`, id, "Hesap "+fmt.Sprint(n), id+"@example.com", role, verified); err != nil {
		t.Fatal(err)
	}
	if role == "player" {
		if _, err := db.Exec(`INSERT INTO player_profiles(user_id,availability,discoverable,updated_at) VALUES($1,'seeking_team',$2,now())`, id, discoverable); err != nil {
			t.Fatal(err)
		}
	}
	if role == "club" {
		if _, err := db.Exec(`INSERT INTO clubs(user_id,updated_at) VALUES($1,now())`, id); err != nil {
			t.Fatal(err)
		}
	}
	return id
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestConnectionsFollowDiscoveryRulesAndRevealContactOnAccept(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	svc := application.New(data.New(db))
	player := user(t, db, 801, "player", false, true)
	hidden := user(t, db, 802, "player", false, false)
	club := user(t, db, 803, "club", true, false)
	unverified := user(t, db, 804, "club", false, false)
	coach := user(t, db, 805, "coach", true, false)

	// Discovery rules: unreachable targets look like missing profiles.
	for _, c := range []struct{ from, to string }{{player, unverified}, {player, hidden}, {unverified, player}, {club, hidden}} {
		if _, err := svc.Send(ctx, c.from, c.to, ""); !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("%s -> %s should be unreachable, got %v", c.from, c.to, err)
		}
	}

	sent, err := svc.Send(ctx, player, club, "Merhaba, kaleciyim.")
	if err != nil || sent.Status != "pending" || sent.Direction != "outgoing" || sent.Contact != nil {
		t.Fatalf("send: %+v %v", sent, err)
	}
	if _, err := svc.Send(ctx, club, player, ""); !errors.Is(err, domain.ErrDuplicate) {
		t.Fatalf("reverse request while pending must be a duplicate, got %v", err)
	}
	if status, _ := svc.Status(ctx, club, player); status.State != "incoming" {
		t.Fatalf("club status: %+v", status)
	}
	if _, err := svc.Respond(ctx, player, sent.ID, "accept"); !errors.Is(err, domain.ErrInvalidAction) {
		t.Fatal("sender accepted its own request")
	}

	accepted, err := svc.Respond(ctx, club, sent.ID, "accept")
	if err != nil || accepted.Status != "accepted" || accepted.Contact == nil || accepted.Contact.Email != player+"@example.com" {
		t.Fatalf("accept: %+v %v", accepted, err)
	}
	if again, err := svc.Respond(ctx, club, sent.ID, "accept"); err != nil || again.Status != "accepted" {
		t.Fatal("repeating accept should be a no-op")
	}
	inbox, err := svc.Inbox(ctx, player)
	if err != nil || len(inbox.Accepted) != 1 || inbox.Accepted[0].Contact.Email != club+"@example.com" {
		t.Fatalf("player inbox: %+v %v", inbox, err)
	}
	var notes int
	if err := db.QueryRow(`SELECT (SELECT count(*) FROM notifications WHERE recipient_id=$1 AND kind='connection')+(SELECT count(*) FROM notifications WHERE recipient_id=$2 AND kind='connection')`, club, player).Scan(&notes); err != nil || notes != 2 {
		t.Fatalf("expected request and accept notifications, got %d %v", notes, err)
	}

	// Coach reaches the player; the player declines; then the coach may ask again.
	coachReq, err := svc.Send(ctx, coach, player, "")
	if err != nil {
		t.Fatal(err)
	}
	if out, err := svc.Respond(ctx, player, coachReq.ID, "decline"); err != nil || out.Status != "declined" || out.Contact != nil {
		t.Fatalf("decline: %+v %v", out, err)
	}
	second, err := svc.Send(ctx, coach, player, "")
	if err != nil {
		t.Fatalf("new request after decline: %v", err)
	}
	if out, err := svc.Respond(ctx, coach, second.ID, "cancel"); err != nil || out.Status != "cancelled" {
		t.Fatalf("cancel: %+v %v", out, err)
	}

	// Daily limit counts every request the sender made in the last day.
	for i := 0; i < domain.DailyLimit; i++ {
		if _, err := db.Exec(`INSERT INTO connection_requests(id,sender_id,recipient_id,player_id,partner_id,status,responded_at) VALUES($1,$2,$3,$3,$2,'cancelled',now())`, fmt.Sprintf("%032x", 900+i), coach, player); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := svc.Send(ctx, coach, player, ""); !errors.Is(err, domain.ErrRateLimited) {
		t.Fatalf("daily limit not enforced: %v", err)
	}
}
