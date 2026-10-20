package data_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"testing"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/notifications/application"
	"futcareer/backend/internal/notifications/data"
	"futcareer/backend/internal/notifications/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func account(t *testing.T, db *sql.DB, n int, role string) string {
	t.Helper()
	id := fmt.Sprintf("%032x", n)
	_, err := db.Exec(`INSERT INTO users(id,full_name,email,password_hash,role,city,created_at,adult_confirmed,active) VALUES($1,'Note QA',$2,'hash',$3,'Ankara',now(),true,true)`, id, id+"@example.com", role)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestAnnouncementsFanOutOncePerRecipientByAudience(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	svc := application.NewAnnouncements(data.New(db))
	player := account(t, db, 501, "player")
	club := account(t, db, 502, "club")
	account(t, db, 503, "coach")

	all, err := svc.Create(ctx, application.AnnouncementInput{Title: "Yeni fırsat", Body: "Ankara'da yeni ilan", Audience: "all"})
	if err != nil || all.Recipients != 3 {
		t.Fatalf("all audience: %+v %v", all, err)
	}
	players, err := svc.Create(ctx, application.AnnouncementInput{Title: "Oyuncu fırsatı", Body: "Takım arıyoruz", Audience: "player"})
	if err != nil || players.Recipients != 1 {
		t.Fatalf("player audience: %+v %v", players, err)
	}
	one, err := svc.Create(ctx, application.AnnouncementInput{Title: "Kişisel", Body: "Sana özel", Audience: "account", Email: player + "@example.com"})
	if err != nil || one.Recipients != 1 {
		t.Fatalf("account audience: %+v %v", one, err)
	}
	var count int
	if err := db.QueryRow(`SELECT count(*) FROM notifications WHERE recipient_id=$1 AND kind='opportunity'`, player).Scan(&count); err != nil || count != 3 {
		t.Fatalf("player should have 3 opportunities, got %d %v", count, err)
	}
	if err := db.QueryRow(`SELECT count(*) FROM notifications WHERE recipient_id=$1 AND kind='opportunity'`, club).Scan(&count); err != nil || count != 1 {
		t.Fatalf("club should get only the all-audience announcement, got %d", count)
	}

	list, err := svc.List(ctx)
	if err != nil || len(list) != 3 {
		t.Fatalf("list: %d %v", len(list), err)
	}

	_, err = svc.Create(ctx, application.AnnouncementInput{Title: "Kişisel", Body: "Sana özel", Audience: "account", Email: "nobody@example.com"})
	var fields auth.ValidationError
	if !errors.As(err, &fields) {
		t.Fatalf("unknown account accepted: %v", err)
	}
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestDeleteRemovesOnlyTheRecipientsChosenNotifications(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	svc := application.New(data.New(db))
	owner := account(t, db, 601, "player")
	other := account(t, db, 602, "player")
	note := func(n int, recipient string) string {
		id := fmt.Sprintf("%032x", n)
		_, err := db.Exec(`INSERT INTO notifications(id,recipient_id,kind,title,body,resource_id,source_key,created_at) VALUES($1,$2,'opportunity','Başlık','Metin',$1,'test:'||$1,now())`, id, recipient)
		if err != nil {
			t.Fatal(err)
		}
		return id
	}
	first, second, third := note(1, owner), note(2, owner), note(3, owner)
	foreign := note(4, other)
	count := func(recipient string) int {
		var n int
		if err := db.QueryRow(`SELECT count(*) FROM notifications WHERE recipient_id=$1`, recipient).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}

	if err := svc.DeleteSelected(ctx, owner, []string{first, foreign}); err != nil {
		t.Fatal(err)
	}
	if count(owner) != 2 || count(other) != 1 {
		t.Fatalf("selected delete: owner %d other %d", count(owner), count(other))
	}
	var fields auth.ValidationError
	if err := svc.DeleteSelected(ctx, owner, nil); !errors.As(err, &fields) {
		t.Fatalf("empty selection accepted: %v", err)
	}
	if err := svc.DeleteSelected(ctx, owner, []string{"bad"}); !errors.As(err, &fields) {
		t.Fatalf("invalid id accepted: %v", err)
	}
	if err := svc.DeleteAll(ctx, owner); err != nil {
		t.Fatal(err)
	}
	if count(owner) != 0 || count(other) != 1 {
		t.Fatalf("delete all: owner %d other %d (%s %s)", count(owner), count(other), second, third)
	}
}

// Notifications store who acted, never their name: the current name is shown
// and pushed, and a deleted account reads "Silinmiş hesap" (20 Oct 2026).
func TestActorNameIsReadNotStored(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	repo := data.New(db)
	recipient := account(t, db, 601, "player")
	actor := account(t, db, 602, "player")
	if _, err := db.Exec(`UPDATE users SET full_name='Deniz Kaya' WHERE id=$1`, actor); err != nil {
		t.Fatal(err)
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err = data.CreateInTx(ctx, tx, domain.NewConnectionRequest(recipient, actor, actor)); err != nil {
		t.Fatal(err)
	}
	// A placeholder without an actor is refused.
	if err = data.CreateInTx(ctx, tx, domain.NewNotification{RecipientID: recipient, Kind: domain.KindFollow, Title: domain.Actor, Body: "x", ResourceID: actor, SourceKey: "orphan"}); err == nil {
		t.Fatal("actor placeholder accepted without an actor")
	}
	if err = tx.Commit(); err != nil {
		t.Fatal(err)
	}
	var stored string
	if err = db.QueryRow(`SELECT title||' '||body FROM notifications WHERE recipient_id=$1`, recipient).Scan(&stored); err != nil || strings.Contains(stored, "Deniz") {
		t.Fatalf("name stored in the row: %q %v", stored, err)
	}
	body := func() string {
		t.Helper()
		page, err := repo.List(ctx, recipient, 1, 20)
		if err != nil || len(page.Items) != 1 {
			t.Fatalf("list: %+v %v", page, err)
		}
		return page.Items[0].Body
	}
	if got := body(); !strings.HasPrefix(got, "Deniz Kaya seninle") {
		t.Fatalf("current name not shown: %q", got)
	}
	pushed, err := repo.ClaimPending(ctx, 10)
	if err != nil || len(pushed) != 1 || !strings.HasPrefix(pushed[0].Body, "Deniz Kaya seninle") {
		t.Fatalf("push text: %+v %v", pushed, err)
	}
	if _, err = db.Exec(`DELETE FROM users WHERE id=$1`, actor); err != nil {
		t.Fatal(err)
	}
	if got := body(); !strings.HasPrefix(got, domain.DeletedActor+" seninle") {
		t.Fatalf("deleted actor still named: %q", got)
	}
}
