package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"futcareer/backend/internal/games/domain"
	ratingdata "futcareer/backend/internal/rating/data"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

// begin locks the account row; every game write (and rating task claims)
// takes this lock, so plays and points stay consistent per account.
func (r *Postgres) begin(ctx context.Context, userID string) (*sql.Tx, string, time.Time, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, "", time.Time{}, err
	}
	var role string
	var now time.Time
	err = tx.QueryRowContext(ctx, `SELECT role FROM users WHERE id=$1 AND active AND role IN ('player','club','coach') FOR UPDATE`, userID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		err = domain.ErrForbidden
	}
	if err == nil {
		err = tx.QueryRowContext(ctx, `SELECT clock_timestamp()`).Scan(&now)
	}
	if err != nil {
		tx.Rollback()
		return nil, "", now, err
	}
	return tx, role, now.UTC(), nil
}

// istanbulDay is the calendar day plays count against; it resets at local midnight.
const istanbulDay = `($1::timestamptz AT TIME ZONE 'Europe/Istanbul')::date`

// usePlay takes one of today's plays for a game, or fails with ErrNoPlays.
func usePlay(ctx context.Context, tx *sql.Tx, userID, game string, now time.Time) error {
	var plays int
	err := tx.QueryRowContext(ctx, `INSERT INTO game_daily_plays(user_id,game,day,plays) VALUES($2,$3,`+istanbulDay+`,1)
		ON CONFLICT(user_id,game,day) DO UPDATE SET plays=game_daily_plays.plays+1 WHERE game_daily_plays.plays < $4
		RETURNING plays`, now, userID, game, domain.DailyPlays).Scan(&plays)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ErrNoPlays
	}
	return err
}

func playsToday(ctx context.Context, tx *sql.Tx, userID string, now time.Time) (domain.Plays, time.Time, error) {
	out := domain.Plays{}
	for _, g := range domain.Games {
		out[g] = 0
	}
	rows, err := tx.QueryContext(ctx, `SELECT game,plays FROM game_daily_plays WHERE user_id=$2 AND day=`+istanbulDay, now, userID)
	if err != nil {
		return out, now, err
	}
	defer rows.Close()
	for rows.Next() {
		var game string
		var plays int
		if err := rows.Scan(&game, &plays); err != nil {
			return out, now, err
		}
		out[game] = plays
	}
	if err = rows.Err(); err != nil {
		return out, now, err
	}
	var reset time.Time
	err = tx.QueryRowContext(ctx, `SELECT ((`+istanbulDay+` + 1)::timestamp AT TIME ZONE 'Europe/Istanbul')`, now).Scan(&reset)
	return out, reset.UTC(), err
}

// award records one rating point for a game event; outside a season it does nothing.
func award(ctx context.Context, tx *sql.Tx, userID, game, ref string, now time.Time) error {
	_, err := ratingdata.AwardInTx(ctx, tx, userID, game, ref, 1, now)
	return err
}

func scanRun(row *sql.Row) (*domain.Run, error) {
	var run domain.Run
	var questions, answers []byte
	err := row.Scan(&run.ID, &run.Status, &questions, &answers, &run.Score, &run.RewardGranted)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(questions, &run.Questions); err != nil {
		return nil, err
	}
	if err = json.Unmarshal(answers, &run.Answers); err != nil {
		return nil, err
	}
	return &run, nil
}

const runColumns = `id,status,questions,answers,score,reward_granted`

func state(ctx context.Context, tx *sql.Tx, userID string, now time.Time, run *domain.Run) (domain.State, error) {
	out := domain.State{ServerTime: now, Run: run}
	var err error
	if out.Plays, out.NextResetAt, err = playsToday(ctx, tx, userID, now); err != nil {
		return out, err
	}
	if out.RatingActive, err = ratingdata.ActiveInTx(ctx, tx, now); err != nil {
		return out, err
	}
	err = tx.QueryRowContext(ctx, `SELECT count(*) FILTER (WHERE status='finished'),count(*) FILTER (WHERE status='finished' AND score>=7),COALESCE(max(score) FILTER (WHERE status='finished'),0),
		(SELECT COALESCE(sum(p.points),0) FROM rating_points p JOIN rating_seasons s ON s.id=p.season_id WHERE p.user_id=$1 AND s.published AND s.starts_at<=$2 AND s.ends_at>$2)
		FROM football_guess_runs WHERE user_id=$1`, userID, now).Scan(&out.Stats.Played, &out.Stats.Wins, &out.Stats.BestScore, &out.Stats.SeasonPoints)
	if err != nil {
		return out, err
	}
	shootout, err := scanShootout(tx.QueryRowContext(ctx, shootoutColumns+` FROM penalty_shootouts WHERE user_id=$1 AND status='active'`, userID))
	if errors.Is(err, domain.ErrNotFound) {
		return out, nil
	}
	out.Shootout = shootout
	return out, err
}

const shootoutColumns = `SELECT id,status,kicks,COALESCE(winner,''),reward_granted`

func scanShootout(row *sql.Row) (*domain.Shootout, error) {
	var sh domain.Shootout
	var kicks []byte
	err := row.Scan(&sh.ID, &sh.Status, &kicks, &sh.Winner, &sh.RewardGranted)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(kicks, &sh.Kicks); err != nil {
		return nil, err
	}
	return &sh, nil
}
func finish(ctx context.Context, tx *sql.Tx, userID string, now time.Time, run *domain.Run) (domain.State, error) {
	out, err := state(ctx, tx, userID, now, run)
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}
func (r *Postgres) State(ctx context.Context, userID string) (domain.State, error) {
	tx, _, now, err := r.begin(ctx, userID)
	if err != nil {
		return domain.State{}, err
	}
	defer tx.Rollback()
	run, err := scanRun(tx.QueryRowContext(ctx, `SELECT `+runColumns+` FROM football_guess_runs WHERE user_id=$1 ORDER BY started_at DESC,id DESC LIMIT 1`, userID))
	if errors.Is(err, domain.ErrNotFound) {
		err = nil
	}
	if err != nil {
		return domain.State{}, err
	}
	return finish(ctx, tx, userID, now, run)
}
func (r *Postgres) Start(ctx context.Context, userID, runID string, pick domain.QuestionPicker) (domain.State, error) {
	tx, _, now, err := r.begin(ctx, userID)
	if err != nil {
		return domain.State{}, err
	}
	defer tx.Rollback()
	run, err := scanRun(tx.QueryRowContext(ctx, `SELECT `+runColumns+` FROM football_guess_runs WHERE user_id=$1 AND status='active'`, userID))
	if err == nil {
		return finish(ctx, tx, userID, now, run)
	}
	if !errors.Is(err, domain.ErrNotFound) {
		return domain.State{}, err
	}
	if err = usePlay(ctx, tx, userID, domain.GameFootballGuess, now); err != nil {
		return domain.State{}, err
	}
	seen, err := seenQuestions(ctx, tx, userID)
	if err != nil {
		return domain.State{}, err
	}
	questions, err := pick(seen)
	if err != nil {
		return domain.State{}, err
	}
	data, err := json.Marshal(questions)
	if err != nil {
		return domain.State{}, err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO football_guess_runs(id,user_id,questions,started_at) VALUES($1,$2,$3,$4)`, runID, userID, data, now); err != nil {
		return domain.State{}, err
	}
	if err = markSeen(ctx, tx, userID, questions, now); err != nil {
		return domain.State{}, err
	}
	run = &domain.Run{ID: runID, Status: "active", Questions: questions, Answers: []domain.Answer{}}
	return finish(ctx, tx, userID, now, run)
}
func (r *Postgres) Answer(ctx context.Context, userID, runID, questionID, optionID string) (domain.State, error) {
	tx, _, now, err := r.begin(ctx, userID)
	if err != nil {
		return domain.State{}, err
	}
	defer tx.Rollback()
	run, err := scanRun(tx.QueryRowContext(ctx, `SELECT `+runColumns+` FROM football_guess_runs WHERE id=$1 AND user_id=$2 FOR UPDATE`, runID, userID))
	if err != nil {
		return domain.State{}, err
	}
	changed, err := run.Answer(questionID, optionID)
	if err != nil {
		return domain.State{}, err
	}
	if changed {
		// Each correct answer is one rating point (17 Oct 2026); games grant no other reward.
		if last := run.Answers[len(run.Answers)-1]; last.Correct {
			if err = award(ctx, tx, userID, domain.GameFootballGuess, runID+":"+last.QuestionID, now); err != nil {
				return domain.State{}, err
			}
		}
		answers, err := json.Marshal(run.Answers)
		if err != nil {
			return domain.State{}, err
		}
		_, err = tx.ExecContext(ctx, `UPDATE football_guess_runs SET status=$2,answers=$3,score=$4,reward_granted=$5,finished_at=CASE WHEN $2='finished' THEN $6::timestamptz ELSE NULL END WHERE id=$1`, runID, run.Status, answers, run.Score, run.RewardGranted, now)
		if err != nil {
			return domain.State{}, err
		}
	}
	return finish(ctx, tx, userID, now, run)
}

// seenQuestions is the user's Arma İzi history: catalog id -> last shown.
func seenQuestions(ctx context.Context, tx *sql.Tx, userID string) (map[string]time.Time, error) {
	rows, err := tx.QueryContext(ctx, `SELECT question_id,seen_at FROM football_guess_seen WHERE user_id=$1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]time.Time{}
	for rows.Next() {
		var id string
		var at time.Time
		if err := rows.Scan(&id, &at); err != nil {
			return nil, err
		}
		out[id] = at.UTC()
	}
	return out, rows.Err()
}

// markSeen records a new run's questions as shown at start time.
func markSeen(ctx context.Context, tx *sql.Tx, userID string, questions []domain.Question, now time.Time) error {
	ids := []string{}
	for _, q := range questions {
		if q.SourceID != "" {
			ids = append(ids, q.SourceID)
		}
	}
	data, err := json.Marshal(ids)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO football_guess_seen(user_id,question_id,seen_at) SELECT $1,value,$3 FROM jsonb_array_elements_text($2::jsonb) ON CONFLICT(user_id,question_id) DO UPDATE SET seen_at=EXCLUDED.seen_at,times_seen=football_guess_seen.times_seen+1`, userID, data, now)
	return err
}

// latestRun returns the most recent football run so penalty responses keep it visible.
func latestRun(ctx context.Context, tx *sql.Tx, userID string) (*domain.Run, error) {
	run, err := scanRun(tx.QueryRowContext(ctx, `SELECT `+runColumns+` FROM football_guess_runs WHERE user_id=$1 ORDER BY started_at DESC,id DESC LIMIT 1`, userID))
	if errors.Is(err, domain.ErrNotFound) {
		return nil, nil
	}
	return run, err
}
func (r *Postgres) StartShootout(ctx context.Context, userID, shootoutID string) (domain.State, error) {
	tx, _, now, err := r.begin(ctx, userID)
	if err != nil {
		return domain.State{}, err
	}
	defer tx.Rollback()
	run, err := latestRun(ctx, tx, userID)
	if err != nil {
		return domain.State{}, err
	}
	_, err = scanShootout(tx.QueryRowContext(ctx, shootoutColumns+` FROM penalty_shootouts WHERE user_id=$1 AND status='active'`, userID))
	if err == nil {
		return finish(ctx, tx, userID, now, run)
	}
	if !errors.Is(err, domain.ErrNotFound) {
		return domain.State{}, err
	}
	if err = usePlay(ctx, tx, userID, domain.GamePenalty, now); err != nil {
		return domain.State{}, err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO penalty_shootouts(id,user_id,started_at) VALUES($1,$2,$3)`, shootoutID, userID, now); err != nil {
		return domain.State{}, err
	}
	return finish(ctx, tx, userID, now, run)
}

// KickShootout resolves one kick under the account lock. The computer's side is
// chosen by decide while the row is locked, so a retry can't re-roll it.
func (r *Postgres) KickShootout(ctx context.Context, userID, shootoutID string, index int, side domain.Side, decide func(string, []domain.PenaltyKick) domain.Side) (domain.State, error) {
	tx, _, now, err := r.begin(ctx, userID)
	if err != nil {
		return domain.State{}, err
	}
	defer tx.Rollback()
	run, err := latestRun(ctx, tx, userID)
	if err != nil {
		return domain.State{}, err
	}
	sh, err := scanShootout(tx.QueryRowContext(ctx, shootoutColumns+` FROM penalty_shootouts WHERE id=$1 AND user_id=$2 FOR UPDATE`, shootoutID, userID))
	if err != nil {
		return domain.State{}, err
	}
	replayed, err := sh.Apply(index, side, decide)
	if err != nil {
		return domain.State{}, err
	}
	if !replayed {
		// Every goal the user scores as the shooter is one rating point.
		if kick := sh.Kicks[index]; kick.Role == domain.RoleShooter && kick.Scored {
			if err = award(ctx, tx, userID, domain.GamePenalty, shootoutID+":"+strconv.Itoa(index), now); err != nil {
				return domain.State{}, err
			}
		}
		kicks, err := json.Marshal(sh.Kicks)
		if err != nil {
			return domain.State{}, err
		}
		_, err = tx.ExecContext(ctx, `UPDATE penalty_shootouts SET status=$2,kicks=$3,winner=NULLIF($4,''),reward_granted=$5,finished_at=CASE WHEN $2='finished' THEN $6::timestamptz ELSE NULL END WHERE id=$1`, shootoutID, sh.Status, kicks, sh.Winner, sh.RewardGranted, now)
		if err != nil {
			return domain.State{}, err
		}
	}
	out, err := finish(ctx, tx, userID, now, run)
	if err != nil {
		return out, err
	}
	// The kicked shootout may already be finished, so it is returned explicitly.
	out.Shootout = sh
	return out, nil
}
