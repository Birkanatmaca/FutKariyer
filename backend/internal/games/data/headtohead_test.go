package data_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"

	footballdomain "futcareer/backend/internal/football/domain"
	"futcareer/backend/internal/games/application"
	"futcareer/backend/internal/games/catalog"
	"futcareer/backend/internal/games/data"
	"futcareer/backend/internal/games/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

type fakeStandings struct {
	mu   sync.Mutex
	err  error
	rows []footballdomain.StandingRow
}

func (f *fakeStandings) Standings(context.Context, string) (footballdomain.Standings, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return footballdomain.Standings{Rows: f.rows}, f.err
}
func (f *fakeStandings) fail(err error) {
	f.mu.Lock()
	f.err = err
	f.mu.Unlock()
}

func standingRows() []footballdomain.StandingRow {
	rows := []footballdomain.StandingRow{}
	for i := 0; i < 20; i++ {
		rows = append(rows, footballdomain.StandingRow{
			Rank: i + 1, Team: footballdomain.Team{Name: fmt.Sprintf("Club %02d", i), LogoURL: "https://example.com/" + fmt.Sprint(i) + ".png"},
			Points: 60 - 2*i, Won: 18 - i/2, GoalsFor: 50 - i, GoalsAgainst: 10 + i, GoalDiff: 40 - 2*i,
		})
	}
	return rows
}

func h2hService(t *testing.T, db *sql.DB, source *fakeStandings) *application.Service {
	t.Helper()
	bank, err := catalog.Load()
	if err != nil {
		t.Fatal(err)
	}
	return application.New(data.New(db), bank, source)
}

// storedRound reads the hidden round straight from PostgreSQL to know the answer.
func storedRound(t *testing.T, db *sql.DB, runID, roundID string) domain.H2HRound {
	t.Helper()
	var raw []byte
	if err := db.QueryRow(`SELECT rounds FROM head_to_head_runs WHERE id=$1`, runID).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	var rounds []domain.H2HRound
	if err := json.Unmarshal(raw, &rounds); err != nil {
		t.Fatal(err)
	}
	for _, r := range rounds {
		if r.ID == roundID {
			return r
		}
	}
	t.Fatalf("round %s not stored", roundID)
	return domain.H2HRound{}
}

func other(p domain.Pick) domain.Pick {
	if p == domain.PickLeft {
		return domain.PickRight
	}
	return domain.PickLeft
}

func assertNoLeak(t *testing.T, value any) {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{`"value"`, `"values"`, `"pick"`, `"correct"`, `"winner"`, `"answered"`, `"slug"`} {
		if strings.Contains(string(raw), key) {
			t.Fatalf("round payload leaks %s: %s", key, raw)
		}
	}
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestHeadToHeadRunIsServerSideIdempotentAndEndsOnMiss(t *testing.T) {
	db := testpostgres.New(t).DB
	source := &fakeStandings{rows: standingRows()}
	s := h2hService(t, db, source)
	ctx := context.Background()
	user := actor(t, db, 401, "player")

	empty, err := s.HeadToHead(ctx, user)
	if err != nil || empty.Best != 0 || empty.Plays != 0 {
		t.Fatalf("empty record: %+v %v", empty, err)
	}
	start, err := s.StartHeadToHead(ctx, user)
	if err != nil || start.Streak != 0 || start.Plays != 1 {
		t.Fatalf("start: %+v %v", start, err)
	}
	assertNoLeak(t, start)
	again, err := s.StartHeadToHead(ctx, user)
	if err != nil || again.ID != start.ID || again.Round.ID != start.Round.ID || again.Plays != 1 {
		t.Fatal("a repeated start before answering must return the same run")
	}

	pairs := map[string]bool{}
	round := start.Round
	for i := 0; i < 3; i++ {
		stored := storedRound(t, db, start.ID, round.ID)
		if stored.Left.Value == stored.Right.Value {
			t.Fatal("round with equal values")
		}
		if pairs[stored.PairKey()] {
			t.Fatal("pair repeated within the run")
		}
		pairs[stored.PairKey()] = true
		result, err := s.AnswerHeadToHead(ctx, user, start.ID, round.ID, string(stored.Winner()))
		if err != nil || !result.Correct || result.GameOver || result.Streak != i+1 || result.Best != i+1 || result.NextRound == nil {
			t.Fatalf("correct answer %d: %+v %v", i, result, err)
		}
		if result.Values.Left != stored.Left.Value || result.Values.Right != stored.Right.Value {
			t.Fatal("answer did not reveal the real values")
		}
		assertNoLeak(t, result.NextRound)
		replay, err := s.AnswerHeadToHead(ctx, user, start.ID, round.ID, string(stored.Winner()))
		if err != nil || replay.Streak != result.Streak || replay.NextRound == nil || replay.NextRound.ID != result.NextRound.ID {
			t.Fatal("double submit was not idempotent")
		}
		if _, err = s.AnswerHeadToHead(ctx, user, start.ID, round.ID, string(other(stored.Winner()))); !errors.Is(err, domain.ErrAnswerLocked) {
			t.Fatal("changing a saved pick was accepted")
		}
		round = *result.NextRound
	}

	// A correct pick while standings are down stays unanswered and returns the upstream error.
	stored := storedRound(t, db, start.ID, round.ID)
	source.fail(footballdomain.ErrUpstream)
	if _, err = s.AnswerHeadToHead(ctx, user, start.ID, round.ID, string(stored.Winner())); !errors.Is(err, footballdomain.ErrUpstream) {
		t.Fatalf("expected upstream error, got %v", err)
	}
	// A miss still ends the run without standings.
	over, err := s.AnswerHeadToHead(ctx, user, start.ID, round.ID, string(other(stored.Winner())))
	if err != nil || over.Correct || !over.GameOver || over.NextRound != nil || over.Streak != 3 || over.Best != 3 {
		t.Fatalf("miss: %+v %v", over, err)
	}
	if over.Values.Left != stored.Left.Value || over.Values.Right != stored.Right.Value {
		t.Fatal("game over did not show both real values")
	}
	if _, err = s.StartHeadToHead(ctx, user); !errors.Is(err, footballdomain.ErrUpstream) {
		t.Fatal("start without standings must return the upstream error")
	}
	source.fail(nil)
	var status string
	if err = db.QueryRow(`SELECT status FROM head_to_head_runs WHERE id=$1`, start.ID).Scan(&status); err != nil || status != "finished" {
		t.Fatal("game over did not finish the run")
	}

	// Best only grows; plays count every run.
	next, err := s.StartHeadToHead(ctx, user)
	if err != nil || next.ID == start.ID || next.Best != 3 || next.Plays != 2 {
		t.Fatalf("second run: %+v %v", next, err)
	}
	first := storedRound(t, db, next.ID, next.Round.ID)
	if _, err = s.AnswerHeadToHead(ctx, user, next.ID, next.Round.ID, string(other(first.Winner()))); err != nil {
		t.Fatal(err)
	}
	record, err := s.HeadToHead(ctx, user)
	if err != nil || record.Best != 3 || record.Plays != 2 {
		t.Fatalf("record: %+v %v", record, err)
	}
	var earned int
	if err = db.QueryRow(`SELECT (SELECT count(*) FROM team_request_game_rewards)+(SELECT count(*) FROM team_request_penalty_rewards)`).Scan(&earned); err != nil || earned != 0 {
		t.Fatal("Kafa Kafaya must not grant application rights")
	}
	var hearts int
	if err = db.QueryRow(`SELECT COALESCE((SELECT hearts FROM game_wallets WHERE user_id=$1),3)`, user).Scan(&hearts); err != nil || hearts != 3 {
		t.Fatal("Kafa Kafaya must not cost hearts")
	}
}

func TestHeadToHeadConcurrentDoubleAnswerAndAccess(t *testing.T) {
	db := testpostgres.New(t).DB
	s := h2hService(t, db, &fakeStandings{rows: standingRows()})
	ctx := context.Background()
	user := actor(t, db, 402, "club")
	start, err := s.StartHeadToHead(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	stored := storedRound(t, db, start.ID, start.Round.ID)
	var wg sync.WaitGroup
	results := make([]application.H2HResult, 5)
	errs := make([]error, 5)
	for i := range results {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			results[i], errs[i] = s.AnswerHeadToHead(ctx, user, start.ID, start.Round.ID, string(stored.Winner()))
		}(i)
	}
	wg.Wait()
	for i := range results {
		if errs[i] != nil || results[i].Streak != 1 || results[i].NextRound == nil || results[i].NextRound.ID != results[0].NextRound.ID {
			t.Fatalf("concurrent submit %d: %+v %v", i, results[i], errs[i])
		}
	}
	var count int
	if err = db.QueryRow(`SELECT jsonb_array_length(rounds) FROM head_to_head_runs WHERE id=$1`, start.ID).Scan(&count); err != nil || count != 2 {
		t.Fatalf("double submit added %d rounds", count)
	}

	stranger := actor(t, db, 403, "player")
	if _, err = s.AnswerHeadToHead(ctx, stranger, start.ID, results[0].NextRound.ID, "left"); !errors.Is(err, domain.ErrNotFound) {
		t.Fatal("another user answered someone else's run")
	}
	if _, err = s.AnswerHeadToHead(ctx, user, start.ID, start.Round.ID, "middle"); err == nil {
		t.Fatal("invalid pick accepted")
	}
	if _, err = db.Exec(`UPDATE users SET active=false WHERE id=$1`, user); err != nil {
		t.Fatal(err)
	}
	if _, err = s.HeadToHead(ctx, user); !errors.Is(err, domain.ErrForbidden) {
		t.Fatal("inactive account reached the game")
	}
}

// onlyOneLeague answers for a single league and fails every other one, like a
// slow or unavailable upstream for most leagues.
type onlyOneLeague struct{ slug string }

func (o onlyOneLeague) Standings(_ context.Context, slug string) (footballdomain.Standings, error) {
	if slug != o.slug {
		return footballdomain.Standings{}, footballdomain.ErrUpstream
	}
	return footballdomain.Standings{Rows: standingRows()}, nil
}

func TestHeadToHeadFallsBackToAnAvailableLeague(t *testing.T) {
	db := testpostgres.New(t).DB
	bank, err := catalog.Load()
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	user := actor(t, db, 451, "player")
	s := application.New(data.New(db), bank, onlyOneLeague{slug: "ligue-1"})
	for i := 0; i < 5; i++ {
		start, err := s.StartHeadToHead(ctx, user)
		if err != nil || start.Round.League.Name != "Ligue 1" {
			t.Fatalf("one failing league must not stop the game: %+v %v", start, err)
		}
		if _, err := s.AnswerHeadToHead(ctx, user, start.ID, start.Round.ID, "left"); err != nil {
			t.Fatal(err)
		}
	}
	down := application.New(data.New(db), bank, onlyOneLeague{slug: "none"})
	if _, err := down.StartHeadToHead(ctx, actor(t, db, 452, "player")); !errors.Is(err, footballdomain.ErrUpstream) {
		t.Fatalf("all leagues down must return the upstream error, got %v", err)
	}
}
