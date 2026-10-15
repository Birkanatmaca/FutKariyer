package data

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"

	"futcareer/backend/internal/moderation/domain"
)

// NotBlocked is the SQL condition other features add to their reads: neither
// the viewer nor the other user has blocked the other. Both arguments are SQL
// expressions such as "$1" or "u.id".
func NotBlocked(viewer, other string) string {
	return `NOT EXISTS(SELECT 1 FROM user_blocks ub WHERE (ub.blocker_id=` + viewer + ` AND ub.blocked_id=` + other + `) OR (ub.blocker_id=` + other + ` AND ub.blocked_id=` + viewer + `))`
}

// BlockedInTx reports whether either user blocked the other.
func BlockedInTx(ctx context.Context, tx *sql.Tx, a, b string) (bool, error) {
	var blocked bool
	err := tx.QueryRowContext(ctx, `SELECT NOT `+NotBlocked("$1", "$2"), a, b).Scan(&blocked)
	return blocked, err
}

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

const mobileRoles = `('player','club','coach','organizer')`

func (r *Postgres) Target(ctx context.Context, reporterID, kind, id string) (domain.Target, error) {
	var target domain.Target
	var query string
	switch kind {
	case "post":
		query = `SELECT p.author_id,left(COALESCE(p.body,''),500) FROM social_posts p JOIN users u ON u.id=p.author_id WHERE p.id=$1 AND u.active`
	case "reply":
		query = `SELECT r.author_id,left(r.body,500) FROM social_replies r JOIN users u ON u.id=r.author_id WHERE r.id=$1 AND u.active`
	case "user":
		query = `SELECT id,left(full_name,500) FROM users WHERE id=$1 AND active AND role IN ` + mobileRoles
	default:
		return target, domain.ErrInvalid
	}
	err := r.db.QueryRowContext(ctx, query, id).Scan(&target.UserID, &target.Excerpt)
	if errors.Is(err, sql.ErrNoRows) {
		return target, domain.ErrNotFound
	}
	if err == nil && target.UserID == reporterID {
		return target, domain.ErrForbidden
	}
	return target, err
}

func (r *Postgres) CreateReport(ctx context.Context, id, reporterID string, in domain.ReportInput, target domain.Target) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	// Locking the reporter serialises their reports so the daily limit holds.
	var active bool
	err = tx.QueryRowContext(ctx, `SELECT active FROM users WHERE id=$1 AND role IN `+mobileRoles+` FOR UPDATE`, reporterID).Scan(&active)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !active) {
		return domain.ErrForbidden
	}
	if err != nil {
		return err
	}
	var recent int
	if err := tx.QueryRowContext(ctx, `SELECT count(*) FROM content_reports WHERE reporter_id=$1 AND created_at>now()-interval '1 day'`, reporterID).Scan(&recent); err != nil {
		return err
	}
	if recent >= domain.DailyReportLimit {
		return domain.ErrRateLimited
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO content_reports(id,reporter_id,target_kind,target_id,target_user_id,target_excerpt,reason,note) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
		id, reporterID, in.TargetKind, in.TargetID, target.UserID, target.Excerpt, in.Reason, in.Note)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return domain.ErrDuplicate
	}
	if err != nil {
		return err
	}
	return tx.Commit()
}

const reportColumns = `c.id,c.target_kind,c.target_id,COALESCE(c.target_user_id,''),COALESCE(t.full_name,''),COALESCE(t.role,''),
	c.target_excerpt,c.reason,c.note,COALESCE(rp.full_name,''),c.status,c.created_at,c.resolved_at,
	(SELECT count(*) FROM content_reports o WHERE o.target_kind=c.target_kind AND o.target_id=c.target_id AND o.status='open')
	FROM content_reports c LEFT JOIN users t ON t.id=c.target_user_id LEFT JOIN users rp ON rp.id=c.reporter_id`

func scanReport(row interface{ Scan(...any) error }) (domain.Report, error) {
	var item domain.Report
	var resolved sql.NullTime
	err := row.Scan(&item.ID, &item.TargetKind, &item.TargetID, &item.TargetUserID, &item.TargetName, &item.TargetRole,
		&item.Excerpt, &item.Reason, &item.Note, &item.ReporterName, &item.Status, &item.CreatedAt, &resolved, &item.TargetReports)
	if errors.Is(err, sql.ErrNoRows) {
		return item, domain.ErrNotFound
	}
	item.CreatedAt = item.CreatedAt.UTC()
	if resolved.Valid {
		value := resolved.Time.UTC()
		item.ResolvedAt = &value
	}
	return item, err
}

// Reports lists open reports oldest first, or resolved ones newest first.
func (r *Postgres) Reports(ctx context.Context, status string, page, pageSize int) (domain.ReportPage, error) {
	out := domain.ReportPage{Items: []domain.Report{}, Page: page, PageSize: pageSize}
	open := status == "open"
	if err := r.db.QueryRowContext(ctx, `SELECT count(*) FROM content_reports WHERE (status='open')=$1`, open).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT `+reportColumns+` WHERE (c.status='open')=$1
		ORDER BY CASE WHEN $1 THEN c.created_at END ASC, c.resolved_at DESC, c.id LIMIT $2 OFFSET $3`, open, pageSize, (page-1)*pageSize)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		item, err := scanReport(rows)
		if err != nil {
			return out, err
		}
		out.Items = append(out.Items, item)
	}
	if err := rows.Err(); err != nil {
		return out, err
	}
	out.TotalPages = (out.Total + pageSize - 1) / pageSize
	return out, nil
}

func (r *Postgres) Resolve(ctx context.Context, id, action string) (domain.Report, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Report{}, err
	}
	defer tx.Rollback()
	var kind, targetID, targetUserID, status string
	err = tx.QueryRowContext(ctx, `SELECT target_kind,target_id,COALESCE(target_user_id,''),status FROM content_reports WHERE id=$1 FOR UPDATE`, id).Scan(&kind, &targetID, &targetUserID, &status)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Report{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Report{}, err
	}
	if status != "open" {
		return domain.Report{}, domain.ErrAlreadyFinal
	}
	next := map[string]string{"dismiss": "dismissed", "remove": "removed", "suspend": "suspended"}[action]
	switch action {
	case "remove":
		table := map[string]string{"post": "social_posts", "reply": "social_replies"}[kind]
		if table == "" {
			return domain.Report{}, domain.ErrInvalid // a profile is suspended, not removed
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM `+table+` WHERE id=$1`, targetID); err != nil {
			return domain.Report{}, err
		}
	case "suspend":
		if targetUserID == "" {
			return domain.Report{}, domain.ErrNotFound
		}
		// Same effect as the admin "stop access" action: the account and its
		// content disappear and every session ends.
		result, err := tx.ExecContext(ctx, `UPDATE users SET active=false,auth_version=auth_version+1 WHERE id=$1 AND role<>'admin'`, targetUserID)
		if err != nil {
			return domain.Report{}, err
		}
		if count, _ := result.RowsAffected(); count != 1 {
			return domain.Report{}, domain.ErrForbidden
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM sessions WHERE user_id=$1`, targetUserID); err != nil {
			return domain.Report{}, err
		}
	case "dismiss":
	default:
		return domain.Report{}, domain.ErrInvalid
	}
	if _, err := tx.ExecContext(ctx, `UPDATE content_reports SET status=$3,resolved_at=now() WHERE target_kind=$1 AND target_id=$2 AND status='open'`, kind, targetID, next); err != nil {
		return domain.Report{}, err
	}
	report, err := scanReport(tx.QueryRowContext(ctx, `SELECT `+reportColumns+` WHERE c.id=$1`, id))
	if err != nil {
		return domain.Report{}, err
	}
	return report, tx.Commit()
}

func (r *Postgres) Block(ctx context.Context, blockerID, blockedID string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var exists bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id=$1 AND role IN `+mobileRoles+`)`, blockedID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return domain.ErrNotFound
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, blockerID, blockedID); err != nil {
		return err
	}
	// A block also ends follows and open or accepted introductions between the two.
	if _, err := tx.ExecContext(ctx, `DELETE FROM profile_follows WHERE (profile_id=$1 AND follower_id=$2) OR (profile_id=$2 AND follower_id=$1)`, blockerID, blockedID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE connection_requests SET status='cancelled',responded_at=COALESCE(responded_at,clock_timestamp())
		WHERE status IN ('pending','accepted') AND ((sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1))`, blockerID, blockedID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Postgres) Unblock(ctx context.Context, blockerID, blockedID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2`, blockerID, blockedID)
	return err
}

func (r *Postgres) Blocks(ctx context.Context, blockerID string) ([]domain.BlockedUser, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT u.id,u.full_name,u.role,b.created_at FROM user_blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=$1 ORDER BY b.created_at DESC,u.id LIMIT 500`, blockerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.BlockedUser{}
	for rows.Next() {
		var item domain.BlockedUser
		if err := rows.Scan(&item.ID, &item.FullName, &item.Role, &item.CreatedAt); err != nil {
			return nil, err
		}
		item.CreatedAt = item.CreatedAt.UTC()
		out = append(out, item)
	}
	return out, rows.Err()
}
