package application

import (
	"fmt"
	"math/rand/v2"
	"strings"
	"testing"
	"time"

	"futcareer/backend/internal/games/catalog"
)

func seeded(seed uint64) func(int) int {
	r := rand.New(rand.NewPCG(seed, seed))
	return r.IntN
}

func player(id string, year int, position string, clubs ...string) catalog.Player {
	return catalog.Player{ID: id, Name: "Player " + id, Difficulty: "easy", BirthYear: year, Position: position, Clubs: clubs}
}

func TestPickPlayersPrefersUnseenThenLeastRecentlySeen(t *testing.T) {
	pool := []catalog.Player{}
	for i := 0; i < 8; i++ {
		pool = append(pool, player(fmt.Sprintf("Q%d", i), 1990, "forvet", "a", "b", fmt.Sprint(i)))
	}
	base := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	seen := map[string]time.Time{}
	for i := 0; i < 6; i++ {
		seen[fmt.Sprintf("Q%d", i)] = base.Add(time.Duration(i) * time.Hour)
	}
	for seed := uint64(0); seed < 20; seed++ {
		got := pickPlayers(pool, seen, 4, seeded(seed))
		ids := map[string]bool{}
		for _, p := range got[:2] {
			ids[p.ID] = true
		}
		if !ids["Q6"] || !ids["Q7"] {
			t.Fatalf("unseen players must come first: %v", got)
		}
		if got[2].ID != "Q0" || got[3].ID != "Q1" {
			t.Fatalf("exhausted bucket must reuse the least recently seen: %v", got)
		}
	}
}

func TestPickPlayersConsecutiveRunsDoNotRepeatWhilePoolAllows(t *testing.T) {
	pool := []catalog.Player{}
	for i := 0; i < 12; i++ {
		pool = append(pool, player(fmt.Sprintf("Q%d", i), 1990, "", "a", "b", fmt.Sprint(i)))
	}
	seen := map[string]time.Time{}
	now := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	shown := map[string]int{}
	for run := 0; run < 3; run++ {
		for _, p := range pickPlayers(pool, seen, 4, seeded(uint64(run))) {
			shown[p.ID]++
			seen[p.ID] = now
		}
		now = now.Add(time.Hour)
	}
	if len(shown) != 12 {
		t.Fatalf("three runs of four must cover a pool of twelve: %v", shown)
	}
	// The fourth run repeats the first run's players: the oldest history.
	first := pickPlayers(pool, map[string]time.Time{}, 4, seeded(0))
	fourth := pickPlayers(pool, seen, 4, seeded(9))
	want := map[string]bool{}
	for _, p := range first {
		want[p.ID] = true
	}
	for _, p := range fourth {
		if !want[p.ID] {
			t.Fatalf("fourth run should reuse the oldest players, got %s", p.ID)
		}
	}
}

func TestDistractorsRules(t *testing.T) {
	answer := player("Q1", 1990, "forvet", "a", "b", "c")
	pool := []catalog.Player{
		answer,
		player("Q2", 1991, "forvet", "d", "e", "f"),                                                        // year + position
		player("Q3", 1989, "defans", "d", "e", "g"),                                                        // year
		player("Q4", 1994, "forvet", "d", "e", "h"),                                                        // year + position
		player("Q5", 1970, "forvet", "d", "e", "i"),                                                        // position only
		player("Q6", 1975, "kaleci", "d", "e", "j"),                                                        // nothing
		player("Q7", 1990, "forvet", "a", "b", "c"),                                                        // same clue sequence
		{ID: "Q8", Name: "PLAYER q1", BirthYear: 1990, Position: "forvet", Clubs: []string{"x", "y", "z"}}, // same name
	}
	for seed := uint64(0); seed < 30; seed++ {
		got := distractors(answer, pool, 3, seeded(seed))
		if len(got) != 3 {
			t.Fatalf("want 3 distractors, got %d", len(got))
		}
		ids := []string{}
		for _, p := range got {
			ids = append(ids, p.ID)
		}
		joined := strings.Join(ids, ",")
		for _, banned := range []string{"Q1", "Q7", "Q8", "Q5", "Q6"} {
			if strings.Contains(joined+",", banned+",") {
				t.Fatalf("seed %d: %s offered (%s)", seed, banned, joined)
			}
		}
	}
	// With few similar players the rest are filled from the bucket.
	got := distractors(answer, pool[:1:1], 3, seeded(1))
	if len(got) != 0 {
		t.Fatal("no candidates must yield no distractors")
	}
	got = distractors(answer, []catalog.Player{answer, pool[4], pool[5], pool[1]}, 3, seeded(2))
	if len(got) != 3 || got[0].ID != "Q2" || got[1].ID != "Q5" {
		t.Fatalf("ranking: year+position, then position, then the rest: %v", got)
	}
}
