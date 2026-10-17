package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"futcareer/backend/internal/rating/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

type queryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

const activeSeason = `published AND starts_at <= $1 AND ends_at > $1`

// AwardInTx adds points to the season running at now, inside the caller's
// transaction. The (season, user, source, ref) key makes a retried answer a
// no-op. It reports whether a point was recorded; with no active season
// nothing is recorded and games keep working.
func AwardInTx(ctx context.Context, tx *sql.Tx, userID, source, ref string, points int, now time.Time) (bool, error) {
	result, err := tx.ExecContext(ctx, `INSERT INTO rating_points(season_id,user_id,source,ref,points)
		SELECT id,$2,$3,$4,$5 FROM rating_seasons WHERE `+activeSeason+` ORDER BY starts_at LIMIT 1
		ON CONFLICT DO NOTHING`, now, userID, source, ref, points)
	if err != nil {
		return false, err
	}
	n, err := result.RowsAffected()
	return n > 0, err
}

// ActiveInTx tells games whether answers currently earn points.
func ActiveInTx(ctx context.Context, q queryer, now time.Time) (bool, error) {
	var active bool
	err := q.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM rating_seasons WHERE `+activeSeason+`)`, now).Scan(&active)
	return active, err
}

const seasonColumns = `id,title,description,starts_at,ends_at,prizes,published,created_at,updated_at`

func scanSeason(scan func(...any) error, extra ...any) (domain.Season, error) {
	var s domain.Season
	var prizes []byte
	err := scan(append([]any{&s.ID, &s.Title, &s.Description, &s.StartsAt, &s.EndsAt, &prizes, &s.Published, &s.CreatedAt, &s.UpdatedAt}, extra...)...)
	if errors.Is(err, sql.ErrNoRows) {
		return s, domain.ErrNotFound
	}
	if err != nil {
		return s, err
	}
	if err = json.Unmarshal(prizes, &s.Prizes); err != nil {
		return s, err
	}
	s.StartsAt, s.EndsAt = s.StartsAt.UTC(), s.EndsAt.UTC()
	s.CreatedAt, s.UpdatedAt = s.CreatedAt.UTC(), s.UpdatedAt.UTC()
	return s, nil
}

// visibleSeason is the season an account sees: the running one, else the
// next upcoming one, else the last finished one (to show its winners).
func visibleSeason(ctx context.Context, q queryer, now time.Time) (*domain.Season, error) {
	row := q.QueryRowContext(ctx, `SELECT `+seasonColumns+` FROM rating_seasons WHERE published
		ORDER BY CASE WHEN starts_at <= $1 AND ends_at > $1 THEN 0 WHEN starts_at > $1 THEN 1 ELSE 2 END,
		CASE WHEN starts_at > $1 THEN starts_at END ASC, ends_at DESC LIMIT 1`, now)
	s, err := scanSeason(row.Scan)
	if errors.Is(err, domain.ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

const ranked = `WITH totals AS (
	SELECT u.id,u.full_name,u.role,sum(p.points)::int AS points,max(p.created_at) AS reached
	FROM rating_points p JOIN users u ON u.id=p.user_id
	WHERE p.season_id=$1 AND u.active
	GROUP BY u.id
), ranked AS (
	SELECT *, row_number() OVER (ORDER BY points DESC, reached ASC, id ASC)::int AS rank FROM totals
)`

func standings(ctx context.Context, q queryer, seasonID string, limit int) ([]domain.Standing, error) {
	rows, err := q.QueryContext(ctx, ranked+` SELECT rank,id,full_name,role,points FROM ranked ORDER BY rank LIMIT $2`, seasonID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Standing{}
	for rows.Next() {
		var s domain.Standing
		if err := rows.Scan(&s.Rank, &s.UserID, &s.FullName, &s.Role, &s.Points); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func myStanding(ctx context.Context, q queryer, seasonID, userID string) (*domain.Standing, error) {
	var s domain.Standing
	err := q.QueryRowContext(ctx, ranked+` SELECT rank,id,full_name,role,points FROM ranked WHERE id=$2`, seasonID, userID).
		Scan(&s.Rank, &s.UserID, &s.FullName, &s.Role, &s.Points)
	if errors.Is(err, sql.ErrNoRows) {
		return &domain.Standing{UserID: userID}, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func tasks(ctx context.Context, q queryer) ([]domain.Task, error) {
	rows, err := q.QueryContext(ctx, `SELECT kind,active,target,points FROM rating_tasks ORDER BY array_position(ARRAY['play_games','share_post','follow_accounts','h2h_streak'],kind)`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Task{}
	for rows.Next() {
		var t domain.Task
		if err := rows.Scan(&t.Kind, &t.Active, &t.Target, &t.Points); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// progress measures one task between the season start and now (or the end).
func progress(ctx context.Context, q queryer, kind, userID string, from, to time.Time) (int, error) {
	var query string
	switch kind {
	case domain.TaskPlayGames:
		query = `SELECT (SELECT count(*) FROM football_guess_runs WHERE user_id=$1 AND started_at>=$2 AND started_at<$3)
			+(SELECT count(*) FROM penalty_shootouts WHERE user_id=$1 AND started_at>=$2 AND started_at<$3)
			+(SELECT count(*) FROM head_to_head_runs WHERE user_id=$1 AND started_at>=$2 AND started_at<$3)`
	case domain.TaskSharePost:
		query = `SELECT count(*) FROM social_posts WHERE author_id=$1 AND created_at>=$2 AND created_at<$3`
	case domain.TaskFollowAccounts:
		query = `SELECT count(*) FROM profile_follows WHERE follower_id=$1 AND created_at>=$2 AND created_at<$3`
	case domain.TaskH2HStreak:
		query = `SELECT COALESCE(max(streak),0) FROM head_to_head_runs WHERE user_id=$1 AND started_at>=$2 AND started_at<$3`
	default:
		return 0, domain.ErrNotFound
	}
	var n int
	err := q.QueryRowContext(ctx, query, userID, from, to).Scan(&n)
	return n, err
}

func taskProgress(ctx context.Context, q queryer, season *domain.Season, userID string, now time.Time) ([]domain.TaskProgress, error) {
	list, err := tasks(ctx, q)
	if err != nil {
		return nil, err
	}
	out := []domain.TaskProgress{}
	running := season != nil && season.Status(now) == "active"
	for _, t := range list {
		if !t.Active {
			continue
		}
		item := domain.TaskProgress{Task: t}
		if running {
			if item.Progress, err = progress(ctx, q, t.Kind, userID, season.StartsAt, now); err != nil {
				return nil, err
			}
			if err = q.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM rating_points WHERE season_id=$1 AND user_id=$2 AND source='task' AND ref=$3)`, season.ID, userID, t.Kind).Scan(&item.Claimed); err != nil {
				return nil, err
			}
		}
		out = append(out, item)
	}
	return out, nil
}

func board(ctx context.Context, q queryer, userID string, now time.Time) (domain.Board, error) {
	out := domain.Board{ServerTime: now, Top: []domain.Standing{}, Tasks: []domain.TaskProgress{}}
	season, err := visibleSeason(ctx, q, now)
	if err != nil {
		return out, err
	}
	out.Season = season
	if season != nil && season.Status(now) != "upcoming" {
		if out.Top, err = standings(ctx, q, season.ID, domain.LeaderboardSize); err != nil {
			return out, err
		}
		if out.Me, err = myStanding(ctx, q, season.ID, userID); err != nil {
			return out, err
		}
	}
	out.Tasks, err = taskProgress(ctx, q, season, userID, now)
	return out, err
}

func lockMember(ctx context.Context, tx *sql.Tx, userID string) (time.Time, error) {
	var role string
	err := tx.QueryRowContext(ctx, `SELECT role FROM users WHERE id=$1 AND active AND role IN ('player','club','coach') FOR UPDATE`, userID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return time.Time{}, domain.ErrForbidden
	}
	if err != nil {
		return time.Time{}, err
	}
	var now time.Time
	err = tx.QueryRowContext(ctx, `SELECT clock_timestamp()`).Scan(&now)
	return now.UTC(), err
}

func (r *Postgres) Board(ctx context.Context, userID string) (domain.Board, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return domain.Board{}, err
	}
	defer tx.Rollback()
	var active bool
	err = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id=$1 AND active AND role IN ('player','club','coach'))`, userID).Scan(&active)
	if err != nil {
		return domain.Board{}, err
	}
	if !active {
		return domain.Board{}, domain.ErrForbidden
	}
	var now time.Time
	if err = tx.QueryRowContext(ctx, `SELECT clock_timestamp()`).Scan(&now); err != nil {
		return domain.Board{}, err
	}
	out, err := board(ctx, tx, userID, now.UTC())
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

// ClaimTask grants a completed task's points once per season. The account
// lock is the same one games take, so progress and claim cannot race.
func (r *Postgres) ClaimTask(ctx context.Context, userID, kind string) (domain.Board, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Board{}, err
	}
	defer tx.Rollback()
	now, err := lockMember(ctx, tx, userID)
	if err != nil {
		return domain.Board{}, err
	}
	season, err := visibleSeason(ctx, tx, now)
	if err != nil {
		return domain.Board{}, err
	}
	if season == nil || season.Status(now) != "active" {
		return domain.Board{}, domain.ErrNoSeason
	}
	var task domain.Task
	err = tx.QueryRowContext(ctx, `SELECT kind,active,target,points FROM rating_tasks WHERE kind=$1`, kind).Scan(&task.Kind, &task.Active, &task.Target, &task.Points)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Board{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Board{}, err
	}
	if !task.Active {
		return domain.Board{}, domain.ErrTaskInactive
	}
	done, err := progress(ctx, tx, kind, userID, season.StartsAt, now)
	if err != nil {
		return domain.Board{}, err
	}
	if done < task.Target {
		return domain.Board{}, domain.ErrTaskIncomplete
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO rating_points(season_id,user_id,source,ref,points) VALUES($1,$2,'task',$3,$4) ON CONFLICT DO NOTHING`, season.ID, userID, kind, task.Points); err != nil {
		return domain.Board{}, err
	}
	out, err := board(ctx, tx, userID, now)
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

func (r *Postgres) Seasons(ctx context.Context) ([]domain.Season, time.Time, error) {
	var now time.Time
	if err := r.db.QueryRowContext(ctx, `SELECT clock_timestamp()`).Scan(&now); err != nil {
		return nil, now, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT `+seasonColumns+`,(SELECT count(DISTINCT user_id) FROM rating_points p WHERE p.season_id=s.id)::int
		FROM rating_seasons s ORDER BY starts_at DESC,id DESC LIMIT 100`)
	if err != nil {
		return nil, now, err
	}
	defer rows.Close()
	out := []domain.Season{}
	for rows.Next() {
		var players int
		s, err := scanSeason(rows.Scan, &players)
		if err != nil {
			return nil, now, err
		}
		s.Players = players
		out = append(out, s)
	}
	return out, now.UTC(), rows.Err()
}

// checkOverlap serialises season writes and rejects a published season whose
// window crosses another published one.
func checkOverlap(ctx context.Context, tx *sql.Tx, s domain.Season) error {
	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtext('rating_seasons'))`); err != nil {
		return err
	}
	if !s.Published {
		return nil
	}
	var overlap bool
	err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM rating_seasons WHERE published AND id<>$1 AND starts_at<$3 AND ends_at>$2)`, s.ID, s.StartsAt, s.EndsAt).Scan(&overlap)
	if err != nil {
		return err
	}
	if overlap {
		return domain.ErrOverlap
	}
	return nil
}

func (r *Postgres) CreateSeason(ctx context.Context, s domain.Season) (domain.Season, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return s, err
	}
	defer tx.Rollback()
	if err = checkOverlap(ctx, tx, s); err != nil {
		return s, err
	}
	prizes, err := json.Marshal(s.Prizes)
	if err != nil {
		return s, err
	}
	out, err := scanSeason(tx.QueryRowContext(ctx, `INSERT INTO rating_seasons(id,title,description,starts_at,ends_at,prizes,published)
		VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING `+seasonColumns, s.ID, s.Title, s.Description, s.StartsAt, s.EndsAt, prizes, s.Published).Scan)
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

func (r *Postgres) UpdateSeason(ctx context.Context, s domain.Season) (domain.Season, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return s, err
	}
	defer tx.Rollback()
	if err = checkOverlap(ctx, tx, s); err != nil {
		return s, err
	}
	prizes, err := json.Marshal(s.Prizes)
	if err != nil {
		return s, err
	}
	out, err := scanSeason(tx.QueryRowContext(ctx, `UPDATE rating_seasons SET title=$2,description=$3,starts_at=$4,ends_at=$5,prizes=$6,published=$7,updated_at=clock_timestamp()
		WHERE id=$1 RETURNING `+seasonColumns, s.ID, s.Title, s.Description, s.StartsAt, s.EndsAt, prizes, s.Published).Scan)
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

// DeleteSeason removes a draft. Published seasons keep their points; they are
// unpublished first.
func (r *Postgres) DeleteSeason(ctx context.Context, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM rating_seasons WHERE id=$1 AND NOT published`, id)
	if err != nil {
		return err
	}
	if n, err := result.RowsAffected(); err != nil || n == 0 {
		if err == nil {
			err = domain.ErrNotFound
		}
		return err
	}
	return nil
}

func (r *Postgres) SeasonBoard(ctx context.Context, id string) (domain.Season, []domain.Standing, error) {
	s, err := scanSeason(r.db.QueryRowContext(ctx, `SELECT `+seasonColumns+` FROM rating_seasons WHERE id=$1`, id).Scan)
	if err != nil {
		return s, nil, err
	}
	top, err := standings(ctx, r.db, id, domain.LeaderboardSize)
	return s, top, err
}

func (r *Postgres) Tasks(ctx context.Context) ([]domain.Task, error) {
	return tasks(ctx, r.db)
}

func (r *Postgres) UpdateTask(ctx context.Context, t domain.Task) (domain.Task, error) {
	err := r.db.QueryRowContext(ctx, `UPDATE rating_tasks SET active=$2,target=$3,points=$4,updated_at=clock_timestamp() WHERE kind=$1 RETURNING kind,active,target,points`, t.Kind, t.Active, t.Target, t.Points).
		Scan(&t.Kind, &t.Active, &t.Target, &t.Points)
	if errors.Is(err, sql.ErrNoRows) {
		return t, domain.ErrNotFound
	}
	return t, err
}
