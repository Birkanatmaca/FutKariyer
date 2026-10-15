package domain

import (
	"errors"
	"fmt"
	"math/rand"
	"testing"
)

func h2hClubs() []H2HClub {
	// Deliberately full of ties so equal metrics must be skipped.
	return []H2HClub{
		{Name: "A", Rank: 1, Points: 20, GoalsFor: 15, GoalsAgainst: 5, Won: 6, GoalDiff: 10},
		{Name: "B", Rank: 2, Points: 20, GoalsFor: 15, GoalsAgainst: 5, Won: 6, GoalDiff: 10},
		{Name: "C", Rank: 3, Points: 18, GoalsFor: 12, GoalsAgainst: 8, Won: 5, GoalDiff: 4},
		{Name: "D", Rank: 4, Points: 18, GoalsFor: 9, GoalsAgainst: 8, Won: 6, GoalDiff: 1},
		{Name: "E", Rank: 5, Points: 10, GoalsFor: 9, GoalsAgainst: 14, Won: 3, GoalDiff: -5},
	}
}

func seeded(seed int64) Rand {
	r := rand.New(rand.NewSource(seed))
	return r.Intn
}

func TestNewRoundNeverYieldsEqualValuesOrRepeatsAPair(t *testing.T) {
	league := H2HLeague{Slug: "test", Name: "Test"}
	for seed := int64(0); seed < 50; seed++ {
		rnd := seeded(seed)
		used := map[string]bool{}
		for i := 0; i < 10; i++ { // 5 clubs -> 10 pairs
			round, err := NewRound(fmt.Sprint(i), league, h2hClubs(), used, rnd)
			if err != nil {
				t.Fatalf("seed %d round %d: %v", seed, i, err)
			}
			if round.Left.Value == round.Right.Value {
				t.Fatalf("equal values for %s: %+v", round.Metric, round)
			}
			if _, ok := MetricByKey(round.Metric); !ok || round.Label == "" {
				t.Fatalf("unknown metric %q", round.Metric)
			}
			if used[round.PairKey()] {
				t.Fatalf("pair repeated: %s", round.PairKey())
			}
			used[round.PairKey()] = true
		}
		if _, err := NewRound("x", league, h2hClubs(), used, rnd); !errors.Is(err, ErrNoPairs) {
			t.Fatal("exhausted pairs must report ErrNoPairs")
		}
	}
}

func TestNewRoundSkipsMetricsWhereTheClubsAreEqual(t *testing.T) {
	clubs := h2hClubs()[:2] // A and B tie on everything except rank
	for seed := int64(0); seed < 20; seed++ {
		round, err := NewRound("r", H2HLeague{Slug: "t"}, clubs, nil, seeded(seed))
		if err != nil || round.Metric != "rank" {
			t.Fatalf("expected the only differing metric (rank), got %q %v", round.Metric, err)
		}
	}
}

func TestWinnerForEveryMetricIncludingLowerWins(t *testing.T) {
	cases := map[string]Pick{
		"points":       PickLeft,  // 30 > 20
		"goalsFor":     PickLeft,  // more wins
		"won":          PickLeft,  // more wins
		"goalDiff":     PickLeft,  // more wins
		"goalsAgainst": PickRight, // fewer wins: right has 20
		"rank":         PickRight, // lower rank number wins
	}
	for metric, want := range cases {
		round := H2HRound{Metric: metric, Left: H2HSide{Value: 30}, Right: H2HSide{Value: 20}}
		if got := round.Winner(); got != want {
			t.Errorf("%s: winner %s, want %s", metric, got, want)
		}
	}
	negative := H2HRound{Metric: "goalDiff", Left: H2HSide{Value: -3}, Right: H2HSide{Value: 2}}
	if negative.Winner() != PickRight {
		t.Error("goal difference must compare signed values")
	}
}

func h2hRun() *H2HRun {
	return &H2HRun{ID: "run", Status: "active", Rounds: []H2HRound{{ID: "r1", League: H2HLeague{Slug: "t"}, Metric: "points", Left: H2HSide{Name: "A", Value: 9}, Right: H2HSide{Name: "B", Value: 3}}}}
}

func TestAnswerCorrectAddsRoundWrongEndsRunAndRetriesAreIdempotent(t *testing.T) {
	run := h2hRun()
	calls := 0
	next := func(used map[string]bool) (H2HRound, error) {
		calls++
		if !used[PairKey("t", "A", "B")] {
			t.Error("used pairs must include earlier rounds")
		}
		return H2HRound{ID: fmt.Sprintf("r%d", calls+1), League: H2HLeague{Slug: "t"}, Metric: "rank", Left: H2HSide{Name: "C", Value: 1}, Right: H2HSide{Name: "D", Value: 4}}, nil
	}
	index, changed, err := run.Answer("r1", PickLeft, next)
	if err != nil || !changed || index != 0 || run.Streak != 1 || len(run.Rounds) != 2 || !run.Rounds[0].Correct {
		t.Fatalf("correct pick: %+v %v", run, err)
	}
	if _, changed, err = run.Answer("r1", PickLeft, next); err != nil || changed || calls != 1 || run.Streak != 1 {
		t.Fatal("identical retry changed the run")
	}
	if _, _, err = run.Answer("r1", PickRight, next); !errors.Is(err, ErrAnswerLocked) {
		t.Fatal("a different pick for an answered round was accepted")
	}
	// Rank: lower wins, so the right (4) is wrong.
	if _, changed, err = run.Answer("r2", PickRight, next); err != nil || !changed || run.Status != "finished" || run.Streak != 1 {
		t.Fatalf("wrong pick must end the run: %+v %v", run, err)
	}
	if run.Current() != nil {
		t.Fatal("finished run still has a current round")
	}
	if _, _, err = run.Answer("r3", PickLeft, next); !errors.Is(err, ErrQuestionOrder) {
		t.Fatal("finished run accepted another round")
	}
	if _, changed, err = run.Answer("r2", PickRight, next); err != nil || changed {
		t.Fatal("replaying the final answer must return the saved result")
	}
}

func TestCorrectAnswerWithoutNextRoundStaysUnanswered(t *testing.T) {
	run := h2hRun()
	unavailable := errors.New("standings down")
	_, _, err := run.Answer("r1", PickLeft, func(map[string]bool) (H2HRound, error) { return H2HRound{}, unavailable })
	if !errors.Is(err, unavailable) || run.Rounds[0].Answered || run.Streak != 0 {
		t.Fatal("a correct pick without a next round must not be saved")
	}
	// A wrong pick never needs the next round.
	if _, changed, err := run.Answer("r1", PickRight, nil); err != nil || !changed || run.Status != "finished" {
		t.Fatal("wrong pick must finish without standings")
	}
}
