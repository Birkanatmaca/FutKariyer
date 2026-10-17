package data_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/gifts/application"
	"futcareer/backend/internal/gifts/data"
	"futcareer/backend/internal/gifts/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func account(t *testing.T, db *sql.DB, n int, role string) string {
	t.Helper()
	id := fmt.Sprintf("%032x", n)
	_, err := db.Exec(`INSERT INTO users(id,full_name,email,password_hash,role,city,created_at,adult_confirmed,active) VALUES($1,'Gift QA',$2,'hash',$3,'Ankara',now(),true,true)`, id, id+"@example.com", role)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestGiftsReachActiveAccountsAndClaimOnce(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	svc := application.New(data.New(db))
	player := account(t, db, 401, "player")
	club := account(t, db, 402, "club")

	// Heart gifts were retired: they can no longer be created, and an old one
	// stays hidden from the inbox and cannot be claimed.
	_, err := svc.Create(ctx, application.CreateInput{Kind: "heart_full", Title: "Kalp", Audience: "all", ValidityDays: 7})
	var invalid auth.ValidationError
	if !errors.As(err, &invalid) {
		t.Fatalf("heart gift accepted: %v", err)
	}
	legacy := fmt.Sprintf("%032x", 9100)
	if _, err := db.Exec(`INSERT INTO gifts(id,kind,title,message,audience,validity_days) VALUES($1,'heart_full','Kalp','','all',7)`, legacy); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO user_gifts(id,gift_id,user_id,created_at,expires_at) VALUES($1,$2,$3,now(),now()+interval '7 days')`, fmt.Sprintf("%032x", 9101), legacy, player); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Create(ctx, application.CreateInput{Kind: domain.KindApplicationRight, Title: "Hak", Audience: "all", ValidityDays: 7}); err != nil {
		t.Fatal(err)
	}
	var clubGifts int
	if err := db.QueryRow(`SELECT count(*) FROM user_gifts WHERE user_id=$1`, club).Scan(&clubGifts); err != nil || clubGifts != 0 {
		t.Fatalf("club should get no player-only gift, got %d %v", clubGifts, err)
	}

	inbox, err := svc.Mine(ctx, player)
	if err != nil || inbox.AvailableCount != 1 || len(inbox.Items) != 1 || inbox.Items[0].Kind != domain.KindApplicationRight {
		t.Fatalf("player inbox: %+v %v", inbox, err)
	}
	if _, _, err := svc.Claim(ctx, player, fmt.Sprintf("%032x", 9101)); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("legacy heart gift claimed: %v", err)
	}

	// The application right is the second gift and is only given to players.
	rightGift := ""
	for _, item := range inbox.Items {
		if item.Kind == domain.KindApplicationRight {
			rightGift = item.ID
		}
	}
	if _, _, err := svc.Claim(ctx, club, rightGift); !errors.Is(err, domain.ErrNotFound) {
		t.Fatal("club claimed a gift it did not receive")
	}
	if _, outcome, err := svc.Claim(ctx, player, rightGift); err != nil || outcome != "claimed" {
		t.Fatalf("claim application right: %s %v", outcome, err)
	}
	if _, outcome, err := svc.Claim(ctx, player, rightGift); err != nil || outcome != "already_claimed" {
		t.Fatal("repeated claim must be idempotent")
	}
	quota := 0
	if err := db.QueryRow(`SELECT count(*) FROM team_request_gift_rewards WHERE player_id=$1`, player).Scan(&quota); err != nil || quota != 1 {
		t.Fatal("application right not recorded exactly once")
	}

	// Expired gifts can no longer be claimed.
	if _, err := svc.Create(ctx, application.CreateInput{Kind: domain.KindApplicationRight, Title: "Hak", Audience: "account", Email: player + "@example.com", ValidityDays: 1}); err != nil {
		t.Fatal(err)
	}
	inbox, _ = svc.Mine(ctx, player)
	expired := inbox.Items[0].ID
	if _, err := db.Exec(`UPDATE user_gifts SET created_at=now() - interval '2 days', expires_at=now() - interval '1 hour' WHERE id=$1`, expired); err != nil {
		t.Fatal(err)
	}
	if _, _, err := svc.Claim(ctx, player, expired); !errors.Is(err, domain.ErrExpired) {
		t.Fatalf("expired gift claimed: %v", err)
	}

	// Unknown account targets are validation errors, not silent sends.
	_, err = svc.Create(ctx, application.CreateInput{Kind: domain.KindApplicationRight, Title: "Hak", Audience: "account", Email: "nobody@example.com", ValidityDays: 3})
	var fields auth.ValidationError
	if !errors.As(err, &fields) {
		t.Fatalf("unknown recipient accepted: %v", err)
	}
}
