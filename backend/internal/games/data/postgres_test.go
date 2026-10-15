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
	"time"

	"futcareer/backend/internal/games/application"
	"futcareer/backend/internal/games/catalog"
	"futcareer/backend/internal/games/data"
	"futcareer/backend/internal/games/domain"
	teams "futcareer/backend/internal/teams/data"
	teamdomain "futcareer/backend/internal/teams/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func actor(t *testing.T, db *sql.DB, n int, role string) string {
	t.Helper()
	id := fmt.Sprintf("%032x", n)
	_, err := db.Exec(`INSERT INTO users(id,full_name,email,password_hash,role,city,created_at) VALUES($1,'Game QA',$2,'hash',$3,'Ankara',now())`, id, id+"@example.com", role)
	if err != nil {
		t.Fatal(err)
	}
	if role == "club" {
		if _, err = db.Exec(`INSERT INTO clubs(user_id,updated_at) VALUES($1,now())`, id); err != nil {
			t.Fatal(err)
		}
	}
	return id
}
func service(t *testing.T, db *sql.DB) *application.Service {
	t.Helper()
	bank, err := catalog.Load()
	if err != nil {
		t.Fatal(err)
	}
	return application.New(data.New(db), bank, nil)
}
func questions(t *testing.T, db *sql.DB, id string) []domain.Question {
	t.Helper()
	var raw []byte
	if err := db.QueryRow(`SELECT questions FROM football_guess_runs WHERE id=$1`, id).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	var out []domain.Question
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	return out
}
func finishRun(t *testing.T, s *application.Service, db *sql.DB, user string, start application.State, correct int) application.State {
	t.Helper()
	last := start
	for i, q := range questions(t, db, start.Run.ID) {
		option := q.CorrectOptionID
		if i >= correct {
			for _, o := range q.Options {
				if o.ID != q.CorrectOptionID {
					option = o.ID
					break
				}
			}
		}
		value, err := s.Answer(context.Background(), user, start.Run.ID, q.ID, option)
		if err != nil {
			t.Fatal(err)
		}
		last = value
	}
	return last
}
func TestRewardIsAtomicUniqueAndSpendableWithOtherCredits(t *testing.T) {
	db := testpostgres.New(t).DB
	s := service(t, db)
	ctx := context.Background()
	user := actor(t, db, 1, "player")
	other := actor(t, db, 2, "player")
	initial, err := s.State(ctx, user)
	if err != nil || initial.Hearts != 3 || initial.NextHeartAt != nil {
		t.Fatalf("initial wallet: %+v %v", initial, err)
	}
	start, err := s.Start(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	if start.Hearts != 2 || start.NextHeartAt == nil || start.Run.Answered != 0 || start.Run.Feedback != nil {
		t.Fatal("invalid start")
	}
	encoded, _ := json.Marshal(start)
	if strings.Contains(string(encoded), "correctOptionId") || strings.Contains(string(encoded), "questions") {
		t.Fatal("future questions or answer leaked")
	}
	qs := questions(t, db, start.Run.ID)
	for i, q := range qs {
		want := "easy"
		if i >= 4 {
			want = "medium"
		}
		if i >= 7 {
			want = "hard"
		}
		if q.Difficulty != want || len(q.Options) != 4 {
			t.Fatal("difficulty progression or options incorrect")
		}
	}
	again, err := s.Start(ctx, user)
	if err != nil || again.Run.ID != start.Run.ID || again.Hearts != 2 {
		t.Fatal("retry spent another heart")
	}
	if _, err = s.Answer(ctx, user, start.Run.ID, qs[1].ID, qs[1].CorrectOptionID); !errors.Is(err, domain.ErrQuestionOrder) {
		t.Fatal("future answer accepted")
	}
	if _, err = s.Answer(ctx, other, start.Run.ID, qs[0].ID, qs[0].CorrectOptionID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatal("other account answered game")
	}
	result := finishRun(t, s, db, user, start, 7)
	if !result.Run.Passed || !result.Run.RewardGranted || result.Stats.EarnedCredits != 1 {
		t.Fatal("passing game didn't grant exactly one credit")
	}
	last := result.Run.Feedback
	for i := 0; i < 5; i++ {
		retry, err := s.Answer(ctx, user, start.Run.ID, last.QuestionID, last.SelectedOptionID)
		if err != nil || retry.Stats.EarnedCredits != 1 {
			t.Fatal("completion retry duplicated reward")
		}
	}
	quota, err := teams.New(db).Quota(ctx, user)
	if err != nil || quota.Earned != 1 || quota.Limit != 4 {
		t.Fatalf("earned quota: %+v %v", quota, err)
	}
	for i := 0; i < 4; i++ {
		club := actor(t, db, 20+i, "club")
		_, q, err := teams.New(db).CreateRequest(ctx, user, club, fmt.Sprintf("%032x", 100+i), "")
		if err != nil || q.Remaining != 3-i {
			t.Fatalf("earned credit was not spendable: %+v %v", q, err)
		}
	}
	club := actor(t, db, 30, "club")
	if _, _, err := teams.New(db).CreateRequest(ctx, user, club, fmt.Sprintf("%032x", 200), ""); !errors.Is(err, teamdomain.ErrQuotaExhausted) {
		t.Fatal("quota exceeded")
	}
	for round := 0; round < 2; round++ {
		next, err := s.Start(ctx, user)
		if err != nil {
			t.Fatal(err)
		}
		failed := finishRun(t, s, db, user, next, 6)
		if failed.Run.RewardGranted || failed.Run.Passed || failed.Stats.EarnedCredits != 1 {
			t.Fatal("failed run awarded a credit")
		}
	}
	if _, err = s.Start(ctx, user); !errors.Is(err, domain.ErrNoHearts) {
		t.Fatal("empty wallet started game")
	}
	if _, err = db.Exec(`UPDATE game_wallets SET refill_anchor=clock_timestamp()-interval '6 hours 1 second' WHERE user_id=$1`, user); err != nil {
		t.Fatal(err)
	}
	refilled, err := s.State(ctx, user)
	if err != nil || refilled.Hearts != 1 || refilled.NextHeartAt == nil || refilled.NextHeartAt.Sub(refilled.ServerTime) < domain.HeartInterval-5*time.Second {
		t.Fatalf("sequential refill: %+v %v", refilled, err)
	}
}
func TestConcurrentStartsAndCompletionDoNotDuplicateHeartsOrRewards(t *testing.T) {
	db := testpostgres.New(t).DB
	s := service(t, db)
	ctx := context.Background()
	user := actor(t, db, 1, "player")
	var wg sync.WaitGroup
	results := make(chan application.State, 8)
	errs := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); value, err := s.Start(ctx, user); results <- value; errs <- err }()
	}
	wg.Wait()
	close(results)
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	runID := ""
	for s := range results {
		if runID == "" {
			runID = s.Run.ID
		}
		if s.Hearts != 2 || s.Run.ID != runID {
			t.Fatal("concurrent start produced multiple games")
		}
	}
	qs := questions(t, db, runID)
	for _, q := range qs[:9] {
		if _, err := s.Answer(ctx, user, runID, q.ID, q.CorrectOptionID); err != nil {
			t.Fatal(err)
		}
	}
	errs = make(chan error, 8)
	q := qs[9]
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, err := s.Answer(ctx, user, runID, q.ID, q.CorrectOptionID); errs <- err }()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	state, err := s.State(ctx, user)
	if err != nil || state.Stats.EarnedCredits != 1 || state.Stats.Played != 1 || state.Stats.Wins != 1 || state.Hearts != 2 {
		t.Fatalf("concurrent reward: %+v %v", state, err)
	}
	coach := actor(t, db, 2, "coach")
	start, err := s.Start(ctx, coach)
	if err != nil {
		t.Fatal(err)
	}
	result := finishRun(t, s, db, coach, start, 10)
	if result.RewardEligible || result.Run.RewardGranted || !result.Run.Passed || result.Stats.EarnedCredits != 0 {
		t.Fatal("non-player received application rights")
	}
}

func sources(t *testing.T, db *sql.DB, runID string) map[string]string {
	t.Helper()
	out := map[string]string{}
	for _, q := range questions(t, db, runID) {
		if q.SourceID == "" {
			t.Fatal("question without catalog id")
		}
		out[q.SourceID] = q.Difficulty
	}
	if len(out) != domain.QuestionCount {
		t.Fatalf("a run repeated a player: %v", out)
	}
	return out
}

func refillHearts(t *testing.T, db *sql.DB, user string) {
	t.Helper()
	if _, err := db.Exec(`UPDATE game_wallets SET hearts=3,refill_anchor=NULL WHERE user_id=$1`, user); err != nil {
		t.Fatal(err)
	}
}

func TestRunsPreferUnseenPlayersThenLeastRecentlySeen(t *testing.T) {
	db := testpostgres.New(t).DB
	s := service(t, db)
	ctx := context.Background()
	user := actor(t, db, 1, "player")
	bank, err := catalog.Load()
	if err != nil {
		t.Fatal(err)
	}
	shown := map[string]bool{}
	for run := 0; run < 6; run++ {
		refillHearts(t, db, user)
		start, err := s.Start(ctx, user)
		if err != nil {
			t.Fatal(err)
		}
		for id := range sources(t, db, start.Run.ID) {
			if shown[id] {
				t.Fatalf("run %d repeated %s while unseen players remained", run+1, id)
			}
			shown[id] = true
		}
		finishRun(t, s, db, user, start, 3)
	}
	var rows, maxSeen int
	if err := db.QueryRow(`SELECT count(*),max(times_seen) FROM football_guess_seen WHERE user_id=$1`, user).Scan(&rows, &maxSeen); err != nil || rows != 60 || maxSeen != 1 {
		t.Fatalf("history rows=%d max=%d err=%v", rows, maxSeen, err)
	}
	// Exhaust the easy bucket: every easy player was seen, oldest first.
	easy := []string{}
	for _, p := range bank.Players {
		if p.Difficulty == "easy" {
			easy = append(easy, p.ID)
		}
	}
	if _, err := db.Exec(`DELETE FROM football_guess_seen WHERE user_id=$1`, user); err != nil {
		t.Fatal(err)
	}
	for i, id := range easy {
		if _, err := db.Exec(`INSERT INTO football_guess_seen(user_id,question_id,seen_at) VALUES($1,$2,timestamptz '2026-01-01' + $3 * interval '1 minute')`, user, id, i); err != nil {
			t.Fatal(err)
		}
	}
	refillHearts(t, db, user)
	start, err := s.Start(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	oldest := map[string]bool{easy[0]: true, easy[1]: true, easy[2]: true, easy[3]: true}
	for id, difficulty := range sources(t, db, start.Run.ID) {
		if difficulty == "easy" && !oldest[id] {
			t.Fatalf("exhausted bucket must reuse the least recently seen, got %s", id)
		}
	}
	var times int
	if err := db.QueryRow(`SELECT times_seen FROM football_guess_seen WHERE user_id=$1 AND question_id=$2`, user, easy[0]).Scan(&times); err != nil || times != 2 {
		t.Fatalf("reuse must bump the history: %d %v", times, err)
	}
	// Resuming the active run neither picks nor records anything new.
	again, err := s.Start(ctx, user)
	if err != nil || again.Run.ID != start.Run.ID {
		t.Fatal("resume changed the run")
	}
	if err := db.QueryRow(`SELECT times_seen FROM football_guess_seen WHERE user_id=$1 AND question_id=$2`, user, easy[0]).Scan(&times); err != nil || times != 2 {
		t.Fatal("resume recorded history again")
	}
}

func TestStartPayloadLeaksNoAnswerOrCatalogData(t *testing.T) {
	db := testpostgres.New(t).DB
	s := service(t, db)
	ctx := context.Background()
	user := actor(t, db, 1, "player")
	start, err := s.Start(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	encoded, _ := json.Marshal(start)
	body := string(encoded)
	for _, leak := range []string{"correctOptionId", "sourceId", "questions", "birthYear", "wikidata", "position"} {
		if strings.Contains(body, leak) {
			t.Fatalf("start payload leaked %q", leak)
		}
	}
	for id := range sources(t, db, start.Run.ID) {
		if strings.Contains(body, `"`+id+`"`) {
			t.Fatalf("start payload leaked catalog id %s", id)
		}
	}
	q := start.Run.Question
	if q == nil || len(q.Clubs) < 3 || len(q.Clubs) > 5 || len(q.Options) != 4 {
		t.Fatalf("question shape %+v", q)
	}
	crests := 0
	for _, c := range q.Clubs {
		if c.HasCrest != catalog.HasCrest(c.ID) || c.Name == "" {
			t.Fatalf("clue club %+v", c)
		}
		if c.HasCrest {
			crests++
		}
	}
	if crests < 2 || !strings.Contains(body, `"hasCrest"`) {
		t.Fatal("clues must carry crest availability")
	}
	names := map[string]bool{}
	for _, o := range q.Options {
		names[catalog.NameKey(o.Name)] = true
	}
	if len(names) != 4 {
		t.Fatal("options must have four distinct names")
	}
}
