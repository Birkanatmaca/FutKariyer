package data

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"futcareer/backend/internal/pro/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

type queryer interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func readStatus(ctx context.Context, q queryer, userID string) (domain.Status, error) {
	var out domain.Status
	var expires sql.NullTime
	err := q.QueryRowContext(ctx, `SELECT m.expires_at,COALESCE(m.expires_at>now(),false),COALESCE(m.private_browsing,false),
		(SELECT COALESCE(sum(pp.bonus_credits),0) FROM pro_periods pp LEFT JOIN team_request_payments t ON t.id=pp.payment_id
			WHERE pp.user_id=u.id AND (pp.payment_id IS NULL OR t.status='paid'))
		FROM users u LEFT JOIN pro_memberships m ON m.user_id=u.id WHERE u.id=$1`, userID).Scan(&expires, &out.Active, &out.PrivateBrowsing, &out.BonusCredits)
	if errors.Is(err, sql.ErrNoRows) {
		return out, domain.ErrNotFound
	}
	if expires.Valid {
		value := expires.Time.UTC()
		out.ExpiresAt = &value
	}
	if !out.Active {
		out.PrivateBrowsing = false
	}
	return out, err
}

func (r *Postgres) Status(ctx context.Context, userID string) (domain.Status, error) {
	return readStatus(ctx, r.db, userID)
}

func (r *Postgres) SetPrivateBrowsing(ctx context.Context, userID string, on bool) (domain.Status, error) {
	result, err := r.db.ExecContext(ctx, `UPDATE pro_memberships SET private_browsing=$2,updated_at=now() WHERE user_id=$1 AND expires_at>now()`, userID, on)
	if err != nil {
		return domain.Status{}, err
	}
	if count, err := result.RowsAffected(); err != nil {
		return domain.Status{}, err
	} else if count != 1 {
		return domain.Status{}, domain.ErrProRequired
	}
	return readStatus(ctx, r.db, userID)
}

// ActivateInTx adds one Pro period inside the caller's transaction. A payment id
// is granted at most once; repeated calls for the same payment change nothing.
// The expiry grows from max(now, current expiry) and players receive the bonus rights.
func ActivateInTx(ctx context.Context, tx *sql.Tx, userID, source, paymentID, periodID string, days int) (bool, error) {
	var role string
	var active bool
	err := tx.QueryRowContext(ctx, `SELECT role,active FROM users WHERE id=$1 FOR UPDATE`, userID).Scan(&role, &active)
	if errors.Is(err, sql.ErrNoRows) {
		return false, domain.ErrNotFound
	}
	if err != nil {
		return false, err
	}
	if !domain.EligibleRole(role) {
		return false, domain.ErrNotEligible
	}
	if paymentID != "" {
		var exists bool
		if err = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM pro_periods WHERE payment_id=$1)`, paymentID).Scan(&exists); err != nil || exists {
			return false, err
		}
	}
	var now time.Time
	var current sql.NullTime
	if err = tx.QueryRowContext(ctx, `SELECT now(),(SELECT expires_at FROM pro_memberships WHERE user_id=$1)`, userID).Scan(&now, &current); err != nil {
		return false, err
	}
	var currentPtr *time.Time
	if current.Valid {
		currentPtr = &current.Time
	}
	ends := domain.Extend(now, currentPtr, days)
	starts := ends.AddDate(0, 0, -days)
	bonus := 0
	if role == "player" {
		bonus = domain.BonusCredits
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO pro_memberships(user_id,expires_at) VALUES($1,$2)
		ON CONFLICT(user_id) DO UPDATE SET expires_at=EXCLUDED.expires_at,updated_at=now()`, userID, ends); err != nil {
		return false, err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO pro_periods(id,user_id,source,payment_id,days,bonus_credits,starts_at,ends_at) VALUES($1,$2,$3,NULLIF($4,''),$5,$6,$7,$8)`,
		periodID, userID, source, paymentID, days, bonus, starts, ends)
	return err == nil, err
}

// RefundInTx shortens the membership by the refunded period; its bonus rights stop
// counting because they only count while the payment stays paid.
func RefundInTx(ctx context.Context, tx *sql.Tx, paymentID string) error {
	_, err := tx.ExecContext(ctx, `UPDATE pro_memberships m SET expires_at=GREATEST(now(),m.expires_at-make_interval(days=>p.days)),updated_at=now()
		FROM pro_periods p WHERE p.payment_id=$1 AND m.user_id=p.user_id`, paymentID)
	return err
}

func (r *Postgres) Grant(ctx context.Context, userID, periodID string) (domain.Status, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Status{}, err
	}
	defer tx.Rollback()
	if _, err = ActivateInTx(ctx, tx, userID, "admin", "", periodID, domain.PeriodDays); err != nil {
		return domain.Status{}, err
	}
	status, err := readStatus(ctx, tx, userID)
	if err != nil {
		return status, err
	}
	return status, tx.Commit()
}

func (r *Postgres) Revoke(ctx context.Context, userID string) (domain.Status, error) {
	var role string
	err := r.db.QueryRowContext(ctx, `SELECT role FROM users WHERE id=$1`, userID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Status{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Status{}, err
	}
	if !domain.EligibleRole(role) {
		return domain.Status{}, domain.ErrNotEligible
	}
	if _, err = r.db.ExecContext(ctx, `UPDATE pro_memberships SET expires_at=LEAST(expires_at,now()),private_browsing=false,updated_at=now() WHERE user_id=$1`, userID); err != nil {
		return domain.Status{}, err
	}
	return readStatus(ctx, r.db, userID)
}
