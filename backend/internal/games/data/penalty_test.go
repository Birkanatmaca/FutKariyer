package data_test

import (
	"context"
	"errors"
	"testing"

	"futcareer/backend/internal/games/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestPenaltyShootoutUsesOnePlayAndScoresOnePointPerGoal(t *testing.T) {
	db := testpostgres.New(t).DB
	s := service(t, db)
	ctx := context.Background()
	user := actor(t, db, 301, "player")
	openSeason(t, db)

	start, err := s.StartShootout(ctx, user)
	if err != nil || start.Penalty == nil || start.Penalty.Status != "active" || start.Plays.Penalty.Used != 1 {
		t.Fatalf("start: %+v %v", start, err)
	}
	again, err := s.StartShootout(ctx, user)
	if err != nil || again.Penalty.ID != start.Penalty.ID || again.Plays.Penalty.Used != 1 {
		t.Fatal("retry used another play or created a second shootout")
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
	if retry.Stats.SeasonPoints != first.Goals.User {
		t.Fatalf("points %d must equal the user's goals %d", retry.Stats.SeasonPoints, first.Goals.User)
	}
	if gameRewards(t, db) != 0 {
		t.Fatal("shootouts must not grant application rights any more")
	}
}
