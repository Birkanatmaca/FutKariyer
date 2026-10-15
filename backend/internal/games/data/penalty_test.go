package data_test

import (
	"context"
	"errors"
	"testing"

	"futcareer/backend/internal/games/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestPenaltyShootoutRewardIsServerSideAndOnce(t *testing.T) {
	db := testpostgres.New(t).DB
	s := service(t, db)
	ctx := context.Background()
	user := actor(t, db, 301, "player")

	start, err := s.StartShootout(ctx, user)
	if err != nil || start.Penalty == nil || start.Penalty.Status != "active" || start.Hearts != 2 {
		t.Fatalf("start: %+v %v", start, err)
	}
	again, err := s.StartShootout(ctx, user)
	if err != nil || again.Penalty.ID != start.Penalty.ID || again.Hearts != 2 {
		t.Fatal("retry spent another heart or created a second shootout")
	}
	if _, err = s.KickShootout(ctx, user, start.Penalty.ID, 1, "left"); !errors.Is(err, domain.ErrQuestionOrder) {
		t.Fatal("kick ahead of order accepted")
	}

	current := start
	for current.Penalty.Status == "active" {
		index := len(current.Penalty.Kicks)
		current, err = s.KickShootout(ctx, user, start.Penalty.ID, index, "center")
		if err != nil {
			t.Fatal(err)
		}
	}
	first := current.Penalty
	if first.Winner == nil {
		t.Fatal("finished shootout without winner")
	}
	retry, err := s.KickShootout(ctx, user, start.Penalty.ID, len(first.Kicks)-1, "center")
	if err != nil || retry.Penalty.Status != "finished" || len(retry.Penalty.Kicks) != len(first.Kicks) {
		t.Fatal("completed kick retry changed the shootout")
	}
	if *first.Winner == "user" && (!first.RewardGranted || retry.Stats.EarnedCredits != 1) {
		t.Fatal("winning shootout did not grant exactly one application right")
	}
	if *first.Winner != "user" && retry.Stats.EarnedCredits != 0 {
		t.Fatal("losing shootout granted a reward")
	}
}
