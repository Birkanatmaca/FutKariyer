package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"futcareer/backend/internal/games/domain"
)

// lockPlayer takes the same account row lock as the other games, so repeated
// or concurrent Kafa Kafaya requests for one user run one at a time.
func (r *Postgres) lockPlayer(ctx context.Context, userID string) (*sql.Tx, time.Time, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, time.Time{}, err
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
		return nil, now, err
	}
	return tx, now.UTC(), nil
}

const h2hColumns = `SELECT id,status,streak,rounds FROM head_to_head_runs`

func scanH2H(row *sql.Row) (*domain.H2HRun, error) {
	var run domain.H2HRun
	var rounds []byte
	err := row.Scan(&run.ID, &run.Status, &run.Streak, &rounds)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(rounds, &run.Rounds); err != nil {
		return nil, err
	}
	return &run, nil
}

func h2hRecord(ctx context.Context, q interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}, userID string) (domain.H2HRecord, error) {
	var rec domain.H2HRecord
	err := q.QueryRowContext(ctx, `SELECT COALESCE(max(streak),0),count(*) FROM head_to_head_runs WHERE user_id=$1`, userID).Scan(&rec.Best, &rec.Plays)
	return rec, err
}

func (r *Postgres) HeadToHeadRecord(ctx context.Context, userID string) (domain.H2HRecord, error) {
	tx, _, err := r.lockPlayer(ctx, userID)
	if err != nil {
		return domain.H2HRecord{}, err
	}
	defer tx.Rollback()
	rec, err := h2hRecord(ctx, tx, userID)
	if err != nil {
		return rec, err
	}
	return rec, tx.Commit()
}

// StartHeadToHead returns the active run while its first round is still
// unanswered (a repeated start), otherwise closes any active run and saves the
// new one.
func (r *Postgres) StartHeadToHead(ctx context.Context, userID string, run domain.H2HRun) (domain.H2HRun, domain.H2HRecord, error) {
	tx, now, err := r.lockPlayer(ctx, userID)
	if err != nil {
		return domain.H2HRun{}, domain.H2HRecord{}, err
	}
	defer tx.Rollback()
	current, err := scanH2H(tx.QueryRowContext(ctx, h2hColumns+` WHERE user_id=$1 AND status='active' FOR UPDATE`, userID))
	if err != nil && !errors.Is(err, domain.ErrNotFound) {
		return domain.H2HRun{}, domain.H2HRecord{}, err
	}
	if current != nil && len(current.Rounds) == 1 && !current.Rounds[0].Answered {
		run = *current
	} else {
		if current != nil {
			if _, err = tx.ExecContext(ctx, `UPDATE head_to_head_runs SET status='finished',finished_at=$2 WHERE id=$1`, current.ID, now); err != nil {
				return domain.H2HRun{}, domain.H2HRecord{}, err
			}
		}
		rounds, err := json.Marshal(run.Rounds)
		if err != nil {
			return domain.H2HRun{}, domain.H2HRecord{}, err
		}
		if _, err = tx.ExecContext(ctx, `INSERT INTO head_to_head_runs(id,user_id,rounds,started_at) VALUES($1,$2,$3,$4)`, run.ID, userID, rounds, now); err != nil {
			return domain.H2HRun{}, domain.H2HRecord{}, err
		}
		run.Status = "active"
	}
	rec, err := h2hRecord(ctx, tx, userID)
	if err != nil {
		return domain.H2HRun{}, rec, err
	}
	return run, rec, tx.Commit()
}

func (r *Postgres) AnswerHeadToHead(ctx context.Context, userID, runID, roundID string, pick domain.Pick, next domain.NextRound) (domain.H2HRun, int, domain.H2HRecord, error) {
	tx, now, err := r.lockPlayer(ctx, userID)
	if err != nil {
		return domain.H2HRun{}, 0, domain.H2HRecord{}, err
	}
	defer tx.Rollback()
	run, err := scanH2H(tx.QueryRowContext(ctx, h2hColumns+` WHERE id=$1 AND user_id=$2 FOR UPDATE`, runID, userID))
	if err != nil {
		return domain.H2HRun{}, 0, domain.H2HRecord{}, err
	}
	index, changed, err := run.Answer(roundID, pick, next)
	if err != nil {
		return domain.H2HRun{}, 0, domain.H2HRecord{}, err
	}
	if changed {
		rounds, err := json.Marshal(run.Rounds)
		if err != nil {
			return domain.H2HRun{}, 0, domain.H2HRecord{}, err
		}
		_, err = tx.ExecContext(ctx, `UPDATE head_to_head_runs SET status=$2,streak=$3,rounds=$4,finished_at=CASE WHEN $2='finished' THEN $5::timestamptz ELSE NULL END WHERE id=$1`, run.ID, run.Status, run.Streak, rounds, now)
		if err != nil {
			return domain.H2HRun{}, 0, domain.H2HRecord{}, err
		}
	}
	rec, err := h2hRecord(ctx, tx, userID)
	if err != nil {
		return domain.H2HRun{}, 0, rec, err
	}
	return *run, index, rec, tx.Commit()
}
