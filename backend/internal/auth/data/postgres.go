package data

import (
	"context"
	"database/sql"
	"errors"

	"futcareer/backend/internal/auth/domain"
	"github.com/jackc/pgx/v5/pgconn"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

func (r *Postgres) Register(ctx context.Context, user domain.User, session domain.Session) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `INSERT INTO users
		(id,full_name,email,password_hash,role,city,created_at,username,active)
		VALUES($1,$2,NULLIF($3,''),$4,$5,$6,$7,NULLIF($8,''),TRUE)`,
		user.ID, user.FullName, user.Email, user.PasswordHash, user.Role, user.City, user.CreatedAt, user.Username,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "users_email_key" {
			return domain.ErrEmailExists
		}
		return err
	}
	if user.Role == "player" {
		if _, err = tx.ExecContext(ctx, `INSERT INTO player_profiles(user_id,availability,discoverable,updated_at,football_type,license_status)
			VALUES($1,'not_available',FALSE,$2,COALESCE(NULLIF($3,''),'unknown'),COALESCE(NULLIF($4,''),'unknown'))`, user.ID, user.CreatedAt, user.FootballType, user.LicenseStatus); err != nil {
			return err
		}
	}
	if _, err = tx.ExecContext(ctx, "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)", session.TokenHash, session.UserID, session.ExpiresAt); err != nil {
		return err
	}
	return tx.Commit()
}

func scanUser(row *sql.Row) (domain.User, error) {
	var user domain.User
	err := row.Scan(&user.ID, &user.FullName, &user.Email, &user.PasswordHash, &user.Role, &user.City, &user.CreatedAt, &user.Username, &user.Active, &user.AuthVersion, &user.Verified, &user.ApprovalStatus)
	if errors.Is(err, sql.ErrNoRows) {
		return user, domain.ErrNotFound
	}
	user.CreatedAt = user.CreatedAt.UTC()
	return user, err
}

const columns = "id,full_name,COALESCE(email,''),password_hash,role,city,created_at,COALESCE(username,''),active,auth_version,verified,approval_status"

func (r *Postgres) UserByLogin(ctx context.Context, login string) (domain.User, error) {
	return scanUser(r.db.QueryRowContext(ctx, "SELECT "+columns+" FROM users WHERE email=$1 OR username=$1", login))
}

func (r *Postgres) UserByEmail(ctx context.Context, email string) (domain.User, error) {
	return scanUser(r.db.QueryRowContext(ctx, "SELECT "+columns+" FROM users WHERE email=$1", email))
}

func (r *Postgres) UserByID(ctx context.Context, id string) (domain.User, error) {
	return scanUser(r.db.QueryRowContext(ctx, "SELECT "+columns+" FROM users WHERE id=$1", id))
}

func (r *Postgres) CreateSession(ctx context.Context, session domain.Session) error {
	result, err := r.db.ExecContext(ctx, "INSERT INTO sessions(token_hash,user_id,expires_at,auth_version,audience) SELECT $1,id,$3,$4,$5 FROM users WHERE id=$2 AND active AND auth_version=$4", session.TokenHash, session.UserID, session.ExpiresAt, session.AuthVersion, session.Audience)
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err == nil && count == 0 {
		return domain.ErrUnauthorized
	}
	return err
}

func (r *Postgres) SessionByHash(ctx context.Context, hash string) (domain.Session, error) {
	var session domain.Session
	err := r.db.QueryRowContext(ctx, "SELECT token_hash,user_id,expires_at,auth_version,audience FROM sessions WHERE token_hash=$1", hash).Scan(&session.TokenHash, &session.UserID, &session.ExpiresAt, &session.AuthVersion, &session.Audience)
	if errors.Is(err, sql.ErrNoRows) {
		return session, domain.ErrNotFound
	}
	session.ExpiresAt = session.ExpiresAt.UTC()
	return session, err
}

func (r *Postgres) DeleteSession(ctx context.Context, hash string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM sessions WHERE token_hash=$1", hash)
	return err
}

func (r *Postgres) DeleteExpiredSessions(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP")
	return err
}

// Apply creates an inactive, pending club or organizer account with its application.
func (r *Postgres) Apply(ctx context.Context, user domain.User, app domain.Application) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `INSERT INTO users(id,full_name,email,password_hash,role,city,created_at,username,active,approval_status)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,FALSE,'pending')`,
		user.ID, user.FullName, user.Email, user.PasswordHash, user.Role, user.City, user.CreatedAt, user.Username)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			switch pgErr.ConstraintName {
			case "users_email_key":
				return domain.ErrEmailExists
			case "users_username_key":
				return domain.ErrUsernameExists
			}
		}
		return err
	}
	if user.Role == "club" {
		if _, err = tx.ExecContext(ctx, `INSERT INTO clubs(user_id,football_type,district,updated_at) VALUES($1,$2,$3,$4)`, user.ID, app.FootballType, app.District, user.CreatedAt); err != nil {
			return err
		}
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO account_applications(user_id,role,contact_name,phone,district,note,submitted_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
		user.ID, user.Role, app.ContactName, app.Phone, app.District, app.Note, user.CreatedAt); err != nil {
		return err
	}
	return tx.Commit()
}
