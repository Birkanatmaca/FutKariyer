package data_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"

	auth "futcareer/backend/internal/auth/application"
	gamesdata "futcareer/backend/internal/games/data"
	gamedomain "futcareer/backend/internal/games/domain"
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

	if _, err := svc.Create(ctx, application.CreateInput{Kind: domain.KindHeartFull, Title: "Kalp", Audience: "all", ValidityDays: 7}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Create(ctx, application.CreateInput{Kind: domain.KindApplicationRight, Title: "Hak", Audience: "all", ValidityDays: 7}); err != nil {
		t.Fatal(err)
	}
	var clubGifts int
	if err := db.QueryRow(`SELECT count(*) FROM user_gifts WHERE user_id=$1`, club).Scan(&clubGifts); err != nil || clubGifts != 1 {
		t.Fatalf("club should get only the heart gift, got %d %v", clubGifts, err)
	}

	inbox, err := svc.Mine(ctx, player)
	if err != nil || inbox.AvailableCount != 2 || len(inbox.Items) != 2 {
		t.Fatalf("player inbox: %+v %v", inbox, err)
	}
	heartGift := inbox.Items[1].ID
	if inbox.Items[1].Kind != domain.KindHeartFull {
		heartGift = inbox.Items[0].ID
	}

	// Empty wallet: a full-heart gift must fill it to three.
	if _, outcome, err := svc.Claim(ctx, player, heartGift); err != nil || outcome != "claimed" {
		t.Fatalf("claim heart gift: %s %v", outcome, err)
	}
	wallet, err := gamesdata.New(db).State(ctx, player)
	if err != nil || wallet.Wallet.Hearts != gamedomain.MaxHearts {
		t.Fatalf("hearts after full gift: %+v %v", wallet.Wallet, err)
	}
	if _, outcome, err := svc.Claim(ctx, player, heartGift); err != nil || outcome != "already_claimed" {
		t.Fatal("repeated claim must be idempotent")
	}
	var hearts int
	if err := db.QueryRow(`SELECT hearts FROM game_wallets WHERE user_id=$1`, player).Scan(&hearts); err != nil || hearts != gamedomain.MaxHearts {
		t.Fatal("repeated claim changed the wallet")
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
	quota := 0
	if err := db.QueryRow(`SELECT count(*) FROM team_request_gift_rewards WHERE player_id=$1`, player).Scan(&quota); err != nil || quota != 1 {
		t.Fatal("application right not recorded exactly once")
	}

	// Expired gifts can no longer be claimed.
	if _, err := svc.Create(ctx, application.CreateInput{Kind: domain.KindHeartOne, Title: "Kalp", Audience: "account", Email: player + "@example.com", ValidityDays: 1}); err != nil {
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
	_, err = svc.Create(ctx, application.CreateInput{Kind: domain.KindHeartOne, Title: "Kalp", Audience: "account", Email: "nobody@example.com", ValidityDays: 3})
	var fields auth.ValidationError
	if !errors.As(err, &fields) {
		t.Fatalf("unknown recipient accepted: %v", err)
	}
}
