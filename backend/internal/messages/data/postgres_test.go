package data_test

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"futcareer/backend/internal/messages/application"
	"futcareer/backend/internal/messages/data"
	"futcareer/backend/internal/messages/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestMessagesBetweenConnectionsAndSquad(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	svc := application.New(data.New(db))
	id := func(n int) string { return fmt.Sprintf("%032x", n) }
	player, club, coach, stranger := id(4101), id(4102), id(4103), id(4104)
	for _, u := range []struct{ id, role string }{{player, "player"}, {club, "club"}, {coach, "coach"}, {stranger, "player"}} {
		var email, username any = u.id + "@example.com", nil
		if u.role == "club" {
			email, username = nil, "u"+u.id[24:]
		}
		if _, err := db.Exec(`INSERT INTO users(id,full_name,email,username,password_hash,role,city,created_at,active) VALUES($1,$2,$3,$4,'x',$5,'Ankara',now(),true)`, u.id, "Hesap "+u.role, email, username, u.role); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(`INSERT INTO club_squad_members(club_user_id,player_id) VALUES($1,$2)`, club, player); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO connection_requests(id,sender_id,recipient_id,player_id,partner_id,status,responded_at) VALUES($1,$2,$3,$2,$3,'accepted',now())`, id(4201), player, coach); err != nil {
		t.Fatal(err)
	}

	if _, err := svc.Send(ctx, stranger, player, "Merhaba"); !errors.Is(err, domain.ErrNotAllowed) {
		t.Fatalf("stranger wrote: %v", err)
	}
	if _, err := svc.Send(ctx, club, player, "  "); err == nil {
		t.Fatal("empty message accepted")
	}
	for _, body := range []string{"Antrenman 20:00'de", "Forma numaranı yaz"} {
		if _, err := svc.Send(ctx, club, player, body); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := svc.Send(ctx, player, coach, "Hocam merhaba"); err != nil {
		t.Fatal(err)
	}
	inbox, err := svc.Inbox(ctx, player)
	if err != nil || len(inbox.Items) != 2 || inbox.Unread != 2 {
		t.Fatalf("player inbox: %+v %v", inbox, err)
	}
	var notes int
	if err := db.QueryRow(`SELECT count(*) FROM notifications WHERE recipient_id=$1 AND kind='message'`, player).Scan(&notes); err != nil || notes != 1 {
		t.Fatalf("one notification per unread burst, got %d %v", notes, err)
	}
	thread, err := svc.Thread(ctx, player, club, "")
	if err != nil || !thread.CanSend || len(thread.Items) != 2 || thread.Items[0].Body != "Forma numaranı yaz" || thread.Items[0].Mine {
		t.Fatalf("thread: %+v %v", thread, err)
	}
	if err := svc.MarkRead(ctx, player, club); err != nil {
		t.Fatal(err)
	}
	if inbox, _ = svc.Inbox(ctx, player); inbox.Unread != 0 {
		t.Fatalf("read conversation still unread: %d", inbox.Unread)
	}
	if err := db.QueryRow(`SELECT count(*) FROM notifications WHERE recipient_id=$1 AND kind='message' AND read_at IS NULL`, player).Scan(&notes); err != nil || notes != 0 {
		t.Fatalf("message notification stays unread: %d", notes)
	}
	// After reading, a new message notifies again.
	if _, err := svc.Send(ctx, club, player, "Yarın maç var"); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT count(*) FROM notifications WHERE recipient_id=$1 AND kind='message'`, player).Scan(&notes); err != nil || notes != 2 {
		t.Fatalf("new burst should notify: %d", notes)
	}
	clubThread, err := svc.Thread(ctx, club, player, "")
	if err != nil || clubThread.PartnerReadAt == nil {
		t.Fatalf("club should see when the player read: %+v %v", clubThread, err)
	}
	// Leaving the squad keeps the history but closes writing.
	if _, err := db.Exec(`UPDATE club_squad_members SET left_at=clock_timestamp() WHERE player_id=$1`, player); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Send(ctx, club, player, "Döner misin?"); !errors.Is(err, domain.ErrNotAllowed) {
		t.Fatalf("wrote after the player left: %v", err)
	}
	if thread, err = svc.Thread(ctx, player, club, ""); err != nil || thread.CanSend || len(thread.Items) != 3 {
		t.Fatalf("read-only history: %+v %v", thread, err)
	}
	// Blocking hides the conversation.
	if _, err := db.Exec(`INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, coach, player); err != nil {
		t.Fatal(err)
	}
	if inbox, _ = svc.Inbox(ctx, player); len(inbox.Items) != 1 {
		t.Fatalf("blocked conversation listed: %+v", inbox)
	}
	if _, err := svc.Thread(ctx, player, coach, ""); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("blocked thread opened: %v", err)
	}
	// Rate limit.
	if _, err := db.Exec(`INSERT INTO club_squad_members(club_user_id,player_id) VALUES($1,$2) ON CONFLICT (club_user_id,player_id) DO UPDATE SET left_at=NULL,joined_at=clock_timestamp()`, club, player); err != nil {
		t.Fatal(err)
	}
	var last error
	for i := 0; i < domain.PerMinute+1; i++ {
		_, last = svc.Send(ctx, club, player, fmt.Sprint("mesaj ", i))
	}
	if !errors.Is(last, domain.ErrRateLimited) {
		t.Fatalf("rate limit: %v", last)
	}
}
