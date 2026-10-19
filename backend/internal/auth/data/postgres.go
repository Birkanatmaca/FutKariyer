package data

import (
	"context"
	"database/sql"
	"errors"
	"strings"

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
	// A self-registered coach starts with the football type and licence given
	// at sign-up; every group stays hidden on the public profile until shown.
	if user.Role == "coach" {
		if _, err = tx.ExecContext(ctx, `INSERT INTO coach_profiles(user_id,license_level,football_type,updated_at)
			VALUES($1,COALESCE(NULLIF($2,''),'unknown'),COALESCE(NULLIF($3,''),'unknown'),$4)`, user.ID, user.LicenseLevel, user.FootballType, user.CreatedAt); err != nil {
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
	var (
		result sql.Result
		err    error
	)
	if session.ActingUserID == "" {
		result, err = r.db.ExecContext(ctx, "INSERT INTO sessions(token_hash,user_id,expires_at,auth_version,audience) SELECT $1,id,$3,$4,$5 FROM users WHERE id=$2 AND active AND auth_version=$4", session.TokenHash, session.UserID, session.ExpiresAt, session.AuthVersion, session.Audience)
	} else {
		// A club session for a coach: both accounts must be active with the
		// expected credentials and the coach must be active staff right now.
		result, err = r.db.ExecContext(ctx, `INSERT INTO sessions(token_hash,user_id,expires_at,auth_version,audience,acting_user_id,acting_auth_version)
			SELECT $1,club.id,$3,$4,$5,coach.id,$7
			FROM users club JOIN users coach ON coach.id=$6
			JOIN club_staff s ON s.club_user_id=club.id AND s.coach_user_id=coach.id AND s.status='active'
			WHERE club.id=$2 AND club.role='club' AND club.active AND club.auth_version=$4
				AND coach.role='coach' AND coach.active AND coach.auth_version=$7`,
			session.TokenHash, session.UserID, session.ExpiresAt, session.AuthVersion, session.Audience, session.ActingUserID, session.ActingAuthVersion)
	}
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
	err := r.db.QueryRowContext(ctx, "SELECT token_hash,user_id,expires_at,auth_version,audience,COALESCE(acting_user_id,''),COALESCE(acting_auth_version,0) FROM sessions WHERE token_hash=$1", hash).Scan(&session.TokenHash, &session.UserID, &session.ExpiresAt, &session.AuthVersion, &session.Audience, &session.ActingUserID, &session.ActingAuthVersion)
	if errors.Is(err, sql.ErrNoRows) {
		return session, domain.ErrNotFound
	}
	session.ExpiresAt = session.ExpiresAt.UTC()
	return session, err
}

func (r *Postgres) StaffPermissions(ctx context.Context, clubID, coachID string) ([]string, error) {
	var list string
	err := r.db.QueryRowContext(ctx, `SELECT array_to_string(permissions,',') FROM club_staff
		WHERE club_user_id=$1 AND coach_user_id=$2 AND status='active'`, clubID, coachID).Scan(&list)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if list == "" {
		return []string{}, nil
	}
	return strings.Split(list, ","), nil
}

func (r *Postgres) DeleteSession(ctx context.Context, hash string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM sessions WHERE token_hash=$1", hash)
	return err
}

func (r *Postgres) DeleteUser(ctx context.Context, id string) error {
	result, err := r.db.ExecContext(ctx, "DELETE FROM users WHERE id=$1 AND role<>'admin'", id)
	if err != nil {
		return err
	}
	if count, err := result.RowsAffected(); err != nil || count != 1 {
		if err == nil {
			err = domain.ErrNotFound
		}
		return err
	}
	return nil
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
