package data

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

var (
	ErrNotFound     = errors.New("application not found")
	ErrInvalidState = errors.New("application already decided")
)

// Application is a club or organizer sign-up as administrators review it.
type Application struct {
	UserID          string     `json:"userId"`
	Role            string     `json:"role"`
	FullName        string     `json:"fullName"`
	ContactName     string     `json:"contactName"`
	Username        string     `json:"username"`
	Email           string     `json:"email"`
	Phone           string     `json:"phone"`
	District        string     `json:"district"`
	FootballType    string     `json:"footballType"`
	Note            string     `json:"note"`
	Status          string     `json:"status"`
	SubmittedAt     time.Time  `json:"submittedAt"`
	DecidedAt       *time.Time `json:"decidedAt"`
	RejectionReason string     `json:"rejectionReason"`
}

type Postgres struct{ db *sql.DB }

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

const columns = `a.user_id,a.role,u.full_name,a.contact_name,COALESCE(u.username,''),COALESCE(u.email,''),a.phone,a.district,COALESCE(c.football_type,''),a.note,u.approval_status,a.submitted_at,a.decided_at,a.rejection_reason`
const joins = ` FROM account_applications a JOIN users u ON u.id=a.user_id LEFT JOIN clubs c ON c.user_id=u.id`

type scanner interface{ Scan(...any) error }

func scan(row scanner) (Application, error) {
	var a Application
	var decided sql.NullTime
	err := row.Scan(&a.UserID, &a.Role, &a.FullName, &a.ContactName, &a.Username, &a.Email, &a.Phone, &a.District, &a.FootballType, &a.Note, &a.Status, &a.SubmittedAt, &decided, &a.RejectionReason)
	if errors.Is(err, sql.ErrNoRows) {
		return a, ErrNotFound
	}
	if err != nil {
		return a, err
	}
	a.SubmittedAt = a.SubmittedAt.UTC()
	if decided.Valid {
		at := decided.Time.UTC()
		a.DecidedAt = &at
	}
	return a, nil
}

// List returns applications in one status; pending ones oldest first so the queue is worked in order.
func (r *Postgres) List(ctx context.Context, status string) ([]Application, error) {
	order := ` ORDER BY a.submitted_at ASC,a.user_id`
	if status != "pending" {
		order = ` ORDER BY a.decided_at DESC NULLS LAST,a.user_id`
	}
	rows, err := r.db.QueryContext(ctx, `SELECT `+columns+joins+` WHERE u.approval_status=$1`+order+` LIMIT 200`, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Application{}
	for rows.Next() {
		a, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// Decide approves (active and verified) or rejects a pending application.
func (r *Postgres) Decide(ctx context.Context, userID string, approve bool, reason string) (Application, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return Application{}, err
	}
	defer tx.Rollback()
	var status string
	err = tx.QueryRowContext(ctx, `SELECT u.approval_status FROM users u JOIN account_applications a ON a.user_id=u.id WHERE u.id=$1 FOR UPDATE OF u,a`, userID).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return Application{}, ErrNotFound
	}
	if err != nil {
		return Application{}, err
	}
	if status != "pending" {
		return Application{}, ErrInvalidState
	}
	if approve {
		_, err = tx.ExecContext(ctx, `UPDATE users SET approval_status='approved',active=TRUE,verified=TRUE WHERE id=$1`, userID)
	} else {
		_, err = tx.ExecContext(ctx, `UPDATE users SET approval_status='rejected',active=FALSE,verified=FALSE WHERE id=$1`, userID)
	}
	if err != nil {
		return Application{}, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE account_applications SET decided_at=clock_timestamp(),rejection_reason=$2 WHERE user_id=$1`, userID, reason); err != nil {
		return Application{}, err
	}
	out, err := scan(tx.QueryRowContext(ctx, `SELECT `+columns+joins+` WHERE a.user_id=$1`, userID))
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}
