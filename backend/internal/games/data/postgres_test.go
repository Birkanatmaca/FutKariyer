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

// openSeason publishes a rating season running now, so game events earn points.
func openSeason(t *testing.T, db *sql.DB) string {
	t.Helper()
	id := fmt.Sprintf("%032x", 9001)
	if _, err := db.Exec(`INSERT INTO rating_seasons(id,title,starts_at,ends_at,published) VALUES($1,'Ekim Sezonu',now()-interval '1 day',now()+interval '29 days',true)`, id); err != nil {
		t.Fatal(err)
	}
	return id
}

func gameRewards(t *testing.T, db *sql.DB) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT (SELECT count(*) FROM team_request_game_rewards)+(SELECT count(*) FROM team_request_penalty_rewards)`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestDailyPlaysLimitStartsAndCorrectAnswersEarnPoints(t *testing.T) {
	db := testpostgres.New(t).DB
	s := service(t, db)
	ctx := context.Background()
	user := actor(t, db, 1, "player")
	other := actor(t, db, 2, "player")
	initial, err := s.State(ctx, user)
	if err != nil || initial.Plays.FootballGuess != (application.PlayCount{Used: 0, Limit: domain.DailyPlays}) || initial.RatingActive || !initial.NextResetAt.After(initial.ServerTime) {
		t.Fatalf("initial state: %+v %v", initial, err)
	}
	if initial.NextResetAt.Sub(initial.ServerTime) > 24*time.Hour {
		t.Fatal("daily reset must be within a day")
	}
	start, err := s.Start(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	if start.Plays.FootballGuess.Used != 1 || start.Run.Answered != 0 || start.Run.Feedback != nil {
		t.Fatal("invalid start")
	}
	encoded, _ := json.Marshal(start)
	if strings.Contains(string(encoded), "correctOptionId") || strings.Contains(string(encoded), "questions") || strings.Contains(string(encoded), "hearts") {
		t.Fatal("future questions, answer or hearts leaked")
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
	if err != nil || again.Run.ID != start.Run.ID || again.Plays.FootballGuess.Used != 1 {
		t.Fatal("resuming used another play")
	}
	if _, err = s.Answer(ctx, user, start.Run.ID, qs[1].ID, qs[1].CorrectOptionID); !errors.Is(err, domain.ErrQuestionOrder) {
		t.Fatal("future answer accepted")
	}
	if _, err = s.Answer(ctx, other, start.Run.ID, qs[0].ID, qs[0].CorrectOptionID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatal("other account answered game")
	}
	// Without a season the game works but earns nothing.
	result := finishRun(t, s, db, user, start, 7)
	if !result.Run.Passed || result.Stats.SeasonPoints != 0 || result.RatingActive {
		t.Fatalf("no-season result: %+v", result)
	}
	openSeason(t, db)
	next, err := s.Start(ctx, user)
	if err != nil || !next.RatingActive || next.Plays.FootballGuess.Used != 2 {
		t.Fatalf("second start: %+v %v", next, err)
	}
	scored := finishRun(t, s, db, user, next, 6)
	if scored.Stats.SeasonPoints != 6 {
		t.Fatalf("six correct answers must be six points, got %d", scored.Stats.SeasonPoints)
	}
	last := scored.Run.Feedback
	for i := 0; i < 3; i++ {
		retry, err := s.Answer(ctx, user, next.Run.ID, last.QuestionID, last.SelectedOptionID)
		if err != nil || retry.Stats.SeasonPoints != 6 {
			t.Fatal("answer retry changed the points")
		}
	}
	if gameRewards(t, db) != 0 {
		t.Fatal("games must not grant application rights any more")
	}
	for i := 3; i <= domain.DailyPlays; i++ {
		run, err := s.Start(ctx, user)
		if err != nil || run.Plays.FootballGuess.Used != i {
			t.Fatalf("start %d: %+v %v", i, run.Plays, err)
		}
		finishRun(t, s, db, user, run, 0)
	}
	if _, err = s.Start(ctx, user); !errors.Is(err, domain.ErrNoPlays) {
		t.Fatal("sixth game of the day started")
	}
	if shootout, err := s.StartShootout(ctx, user); err != nil || shootout.Plays.Penalty.Used != 1 {
		t.Fatal("each game must have its own daily plays")
	}
	if _, err = db.Exec(`UPDATE game_daily_plays SET day=day-1 WHERE user_id=$1`, user); err != nil {
		t.Fatal(err)
	}
	tomorrow, err := s.Start(ctx, user)
	if err != nil || tomorrow.Plays.FootballGuess.Used != 1 {
		t.Fatalf("plays did not reset the next day: %+v %v", tomorrow.Plays, err)
	}
}

func TestConcurrentStartsAndAnswersDoNotDuplicatePlaysOrPoints(t *testing.T) {
	db := testpostgres.New(t).DB
	s := service(t, db)
	ctx := context.Background()
	user := actor(t, db, 1, "player")
	openSeason(t, db)
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
		if s.Plays.FootballGuess.Used != 1 || s.Run.ID != runID {
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
	if err != nil || state.Stats.SeasonPoints != 10 || state.Stats.Played != 1 || state.Stats.Wins != 1 || state.Plays.FootballGuess.Used != 1 {
		t.Fatalf("concurrent points: %+v %v", state, err)
	}
	coach := actor(t, db, 2, "coach")
	start, err := s.Start(ctx, coach)
	if err != nil {
		t.Fatal(err)
	}
	result := finishRun(t, s, db, coach, start, 10)
	if !result.Run.Passed || result.Stats.SeasonPoints != 10 || gameRewards(t, db) != 0 {
		t.Fatal("every member role earns points and nobody earns application rights")
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

func resetPlays(t *testing.T, db *sql.DB, user string) {
	t.Helper()
	if _, err := db.Exec(`DELETE FROM game_daily_plays WHERE user_id=$1`, user); err != nil {
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
		resetPlays(t, db, user)
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
	resetPlays(t, db, user)
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
