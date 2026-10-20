package data

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/platform/audit"
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
	if _, err = tx.ExecContext(ctx, "INSERT INTO sessions(token_hash,user_id,expires_at,device) VALUES($1,$2,$3,$4)", session.TokenHash, session.UserID, session.ExpiresAt, session.Device); err != nil {
		return err
	}
	return tx.Commit()
}

func scanUser(row *sql.Row) (domain.User, error) {
	var user domain.User
	var locked sql.NullTime
	err := row.Scan(&user.ID, &user.FullName, &user.Email, &user.PasswordHash, &user.Role, &user.City, &user.CreatedAt, &user.Username, &user.Active, &user.AuthVersion, &user.Verified, &user.ApprovalStatus, &user.EmailVerified, &locked)
	if errors.Is(err, sql.ErrNoRows) {
		return user, domain.ErrNotFound
	}
	user.CreatedAt = user.CreatedAt.UTC()
	if locked.Valid {
		user.LockedUntil = locked.Time.UTC()
	}
	return user, err
}

const columns = "id,full_name,COALESCE(email,''),password_hash,role,city,created_at,COALESCE(username,''),active,auth_version,verified,approval_status,email_verified_at IS NOT NULL,login_locked_until"

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
		result, err = r.db.ExecContext(ctx, "INSERT INTO sessions(token_hash,user_id,expires_at,auth_version,audience,device) SELECT $1,id,$3,$4,$5,$6 FROM users WHERE id=$2 AND active AND auth_version=$4", session.TokenHash, session.UserID, session.ExpiresAt, session.AuthVersion, session.Audience, session.Device)
	} else {
		// A club session for a coach: both accounts must be active with the
		// expected credentials and the coach must be active staff right now.
		result, err = r.db.ExecContext(ctx, `INSERT INTO sessions(token_hash,user_id,expires_at,auth_version,audience,acting_user_id,acting_auth_version,device)
			SELECT $1,club.id,$3,$4,$5,coach.id,$7,$8
			FROM users club JOIN users coach ON coach.id=$6
			JOIN club_staff s ON s.club_user_id=club.id AND s.coach_user_id=coach.id AND s.status='active'
			WHERE club.id=$2 AND club.role='club' AND club.active AND club.auth_version=$4
				AND coach.role='coach' AND coach.active AND coach.auth_version=$7`,
			session.TokenHash, session.UserID, session.ExpiresAt, session.AuthVersion, session.Audience, session.ActingUserID, session.ActingAuthVersion, session.Device)
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

// Wrong-password slowdown: from the fifth miss in a row the account waits
// 1, 2, 4, 8 and at most 15 minutes before the next try.
const (
	freeLoginFailures = 4
	maxLoginLock      = 15 * time.Minute
)

func (r *Postgres) LoginFailed(ctx context.Context, userID string, now time.Time) (time.Time, error) {
	var failures int
	if err := r.db.QueryRowContext(ctx, `UPDATE users SET failed_logins=failed_logins+1 WHERE id=$1 RETURNING failed_logins`, userID).Scan(&failures); err != nil {
		return time.Time{}, err
	}
	if failures <= freeLoginFailures {
		return time.Time{}, nil
	}
	wait := maxLoginLock
	if shift := failures - freeLoginFailures - 1; shift < 4 {
		wait = time.Minute << shift
	}
	until := now.UTC().Add(wait)
	_, err := r.db.ExecContext(ctx, `UPDATE users SET login_locked_until=$2 WHERE id=$1`, userID, until)
	return until, err
}

func (r *Postgres) LoginSucceeded(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET failed_logins=0,login_locked_until=NULL WHERE id=$1 AND (failed_logins<>0 OR login_locked_until IS NOT NULL)`, userID)
	return err
}

func (r *Postgres) RehashPassword(ctx context.Context, userID, hash string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET password_hash=$2 WHERE id=$1`, userID, hash)
	return err
}

func (r *Postgres) ChangePassword(ctx context.Context, userID, hash, keepTokenHash string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var version int
	err = tx.QueryRowContext(ctx, `UPDATE users SET password_hash=$2,auth_version=auth_version+1,failed_logins=0,login_locked_until=NULL WHERE id=$1 RETURNING auth_version`, userID, hash).Scan(&version)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ErrNotFound
	}
	if err != nil {
		return err
	}
	// Club sessions a coach opened are pinned to the coach's version, so they
	// end with the coach's other sessions.
	if _, err = tx.ExecContext(ctx, `DELETE FROM sessions WHERE (user_id=$1 OR acting_user_id=$1) AND token_hash<>$2`, userID, keepTokenHash); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE sessions SET auth_version=$3 WHERE user_id=$1 AND token_hash=$2`, userID, keepTokenHash, version); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM auth_codes WHERE user_id=$1 AND purpose=$2`, userID, domain.PurposeResetPassword); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Postgres) SaveCode(ctx context.Context, userID, purpose, codeHash string, expires, now time.Time, cooldown time.Duration) error {
	result, err := r.db.ExecContext(ctx, `INSERT INTO auth_codes(user_id,purpose,code_hash,expires_at,sent_at) VALUES($1,$2,$3,$4,$5)
		ON CONFLICT(user_id,purpose) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,attempts=0,sent_at=EXCLUDED.sent_at
		WHERE auth_codes.sent_at<=$6`, userID, purpose, codeHash, expires, now, now.Add(-cooldown))
	if err != nil {
		return err
	}
	if n, err := result.RowsAffected(); err != nil {
		return err
	} else if n == 0 {
		return domain.ErrCodeTooSoon
	}
	return nil
}

func (r *Postgres) UseCode(ctx context.Context, userID, purpose, codeHash string, now time.Time, maxAttempts int) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var stored string
	var expires time.Time
	var attempts int
	err = tx.QueryRowContext(ctx, `SELECT code_hash,expires_at,attempts FROM auth_codes WHERE user_id=$1 AND purpose=$2 FOR UPDATE`, userID, purpose).Scan(&stored, &expires, &attempts)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ErrCodeInvalid
	}
	if err != nil {
		return err
	}
	if !expires.After(now) || attempts >= maxAttempts {
		if _, err = tx.ExecContext(ctx, `DELETE FROM auth_codes WHERE user_id=$1 AND purpose=$2`, userID, purpose); err != nil {
			return err
		}
		if err = tx.Commit(); err != nil {
			return err
		}
		return domain.ErrCodeInvalid
	}
	if stored != codeHash {
		if _, err = tx.ExecContext(ctx, `UPDATE auth_codes SET attempts=attempts+1 WHERE user_id=$1 AND purpose=$2`, userID, purpose); err != nil {
			return err
		}
		if err = tx.Commit(); err != nil {
			return err
		}
		return domain.ErrCodeInvalid
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM auth_codes WHERE user_id=$1 AND purpose=$2`, userID, purpose); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Postgres) MarkEmailVerified(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$1`, userID)
	return err
}

func (r *Postgres) Sessions(ctx context.Context, userID string, now time.Time) ([]domain.Session, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT token_hash,device,created_at,last_seen_at,expires_at,COALESCE(acting_user_id,'') FROM sessions
		WHERE user_id=$1 AND audience='mobile' AND expires_at>$2 ORDER BY last_seen_at DESC,created_at DESC LIMIT 50`, userID, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Session{}
	for rows.Next() {
		s := domain.Session{UserID: userID, Audience: "mobile"}
		if err := rows.Scan(&s.TokenHash, &s.Device, &s.CreatedAt, &s.LastSeen, &s.ExpiresAt, &s.ActingUserID); err != nil {
			return nil, err
		}
		s.CreatedAt, s.LastSeen, s.ExpiresAt = s.CreatedAt.UTC(), s.LastSeen.UTC(), s.ExpiresAt.UTC()
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *Postgres) DeleteUserSession(ctx context.Context, userID, tokenHash string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM sessions WHERE user_id=$1 AND token_hash=$2 AND audience='mobile'`, userID, tokenHash)
	if err != nil {
		return err
	}
	if n, err := result.RowsAffected(); err != nil {
		return err
	} else if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) DeleteOtherSessions(ctx context.Context, userID, keepTokenHash string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM sessions WHERE user_id=$1 AND audience='mobile' AND token_hash<>$2`, userID, keepTokenHash)
	return err
}

func (r *Postgres) TouchSession(ctx context.Context, tokenHash string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE sessions SET last_seen_at=$2 WHERE token_hash=$1 AND last_seen_at<$3`, tokenHash, now, now.Add(-5*time.Minute))
	return err
}

func (r *Postgres) SecondFactor(ctx context.Context, userID string) (domain.AdminSecondFactor, error) {
	var out domain.AdminSecondFactor
	err := r.db.QueryRowContext(ctx, `SELECT COALESCE(totp_secret,''::bytea),totp_enabled_at IS NOT NULL,totp_last_step FROM users WHERE id=$1`, userID).Scan(&out.Sealed, &out.Enabled, &out.LastStep)
	if errors.Is(err, sql.ErrNoRows) {
		return out, domain.ErrNotFound
	}
	return out, err
}

func (r *Postgres) CreateChallenge(ctx context.Context, tokenHash, userID string, pendingSecret []byte, expires time.Time) error {
	if _, err := r.db.ExecContext(ctx, `DELETE FROM admin_challenges WHERE expires_at<now()`); err != nil {
		return err
	}
	_, err := r.db.ExecContext(ctx, `INSERT INTO admin_challenges(token_hash,user_id,pending_secret,expires_at) VALUES($1,$2,$3,$4)`, tokenHash, userID, pendingSecret, expires)
	return err
}

func (r *Postgres) Challenge(ctx context.Context, tokenHash string, now time.Time) (domain.Challenge, error) {
	var out domain.Challenge
	err := r.db.QueryRowContext(ctx, `SELECT user_id,pending_secret,attempts FROM admin_challenges WHERE token_hash=$1 AND expires_at>$2`, tokenHash, now).Scan(&out.UserID, &out.PendingSecret, &out.Attempts)
	if errors.Is(err, sql.ErrNoRows) {
		return out, domain.ErrChallengeInvalid
	}
	return out, err
}

func (r *Postgres) ChallengeFailed(ctx context.Context, tokenHash string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE admin_challenges SET attempts=attempts+1 WHERE token_hash=$1`, tokenHash)
	return err
}

func (r *Postgres) DeleteChallenge(ctx context.Context, tokenHash string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM admin_challenges WHERE token_hash=$1`, tokenHash)
	return err
}

func (r *Postgres) EnableSecondFactor(ctx context.Context, userID string, sealed []byte, step int64, recoveryHashes []string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `UPDATE users SET totp_secret=$2,totp_enabled_at=now(),totp_last_step=$3 WHERE id=$1 AND role='admin'`, userID, sealed, step); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM admin_recovery_codes WHERE user_id=$1`, userID); err != nil {
		return err
	}
	for _, hash := range recoveryHashes {
		if _, err = tx.ExecContext(ctx, `INSERT INTO admin_recovery_codes(user_id,code_hash) VALUES($1,$2)`, userID, hash); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *Postgres) UseStep(ctx context.Context, userID string, step int64) (bool, error) {
	result, err := r.db.ExecContext(ctx, `UPDATE users SET totp_last_step=$2 WHERE id=$1 AND totp_last_step<$2`, userID, step)
	if err != nil {
		return false, err
	}
	n, err := result.RowsAffected()
	return n == 1, err
}

func (r *Postgres) UseRecoveryCode(ctx context.Context, userID, codeHash string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `UPDATE admin_recovery_codes SET used_at=now() WHERE user_id=$1 AND code_hash=$2 AND used_at IS NULL`, userID, codeHash)
	if err != nil {
		return false, err
	}
	n, err := result.RowsAffected()
	return n == 1, err
}

func (r *Postgres) ResetSecondFactor(ctx context.Context, login string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var id string
	err = tx.QueryRowContext(ctx, `UPDATE users SET totp_secret=NULL,totp_enabled_at=NULL,totp_last_step=0,auth_version=auth_version+1
		WHERE (email=$1 OR username=$1) AND role='admin' RETURNING id`, login).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ErrNotFound
	}
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM admin_recovery_codes WHERE user_id=$1`, id); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM sessions WHERE user_id=$1`, id); err != nil {
		return err
	}
	if err = audit.Write(ctx, tx, audit.Entry{ActorType: "system", Action: "admin.2fa.reset", TargetType: "user", TargetID: id}); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Postgres) Audit(ctx context.Context, entry audit.Entry) error {
	return audit.Write(ctx, r.db, entry)
}
