package data

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"futcareer/backend/internal/admin/domain"
	auth "futcareer/backend/internal/auth/domain"
	clubs "futcareer/backend/internal/clubs/domain"
	"github.com/jackc/pgx/v5/pgconn"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

const columns = `u.id,u.full_name,COALESCE(u.email,''),COALESCE(u.username,''),u.password_hash,u.role,u.city,u.active,u.created_at,c.district,c.updated_at`

type scanner interface{ Scan(...any) error }

func scan(row scanner) (domain.Record, error) {
	var record domain.Record
	var district sql.NullString
	var updated sql.NullTime
	u := &record.User
	err := row.Scan(&u.ID, &u.FullName, &u.Email, &u.Username, &u.PasswordHash, &u.Role, &u.City, &u.Active, &u.CreatedAt, &district, &updated)
	if errors.Is(err, sql.ErrNoRows) {
		return record, auth.ErrNotFound
	}
	u.CreatedAt = u.CreatedAt.UTC()
	if district.Valid {
		record.Club = &clubs.Club{UserID: u.ID, District: district.String, UpdatedAt: updated.Time.UTC()}
	}
	return record, err
}
func (r *Postgres) Get(ctx context.Context, id string) (domain.Record, error) {
	return scan(r.db.QueryRowContext(ctx, "SELECT "+columns+" FROM users u LEFT JOIN clubs c ON c.user_id=u.id WHERE u.id=$1", id))
}
func (r *Postgres) List(ctx context.Context, q domain.Query) (domain.Page, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return domain.Page{}, err
	}
	defer tx.Rollback()
	result := domain.Page{Items: []domain.Record{}}
	// strpos treats search text literally, including '%' and '_'.
	where := ` WHERE ($1='' OR strpos(lower(u.full_name),$1)>0 OR strpos(lower(COALESCE(u.email,'')),$1)>0 OR strpos(COALESCE(u.username,''),$1)>0) AND (NOT $2 OR u.role='club')`
	search := strings.ToLower(q.Search)
	if err = tx.QueryRowContext(ctx, "SELECT count(*) FROM users u"+where, search, q.ClubsOnly).Scan(&result.Total); err != nil {
		return result, err
	}
	rows, err := tx.QueryContext(ctx, "SELECT "+columns+" FROM users u LEFT JOIN clubs c ON c.user_id=u.id"+where+" ORDER BY u.created_at DESC,u.id DESC LIMIT $3 OFFSET $4", search, q.ClubsOnly, q.PageSize, (q.Page-1)*q.PageSize)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		record, err := scan(rows)
		if err != nil {
			return result, err
		}
		result.Items = append(result.Items, record)
	}
	if err = rows.Err(); err != nil {
		return result, err
	}
	if err = rows.Close(); err != nil {
		return result, err
	}
	return result, tx.Commit()
}
func conflict(err error) error {
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		switch pg.ConstraintName {
		case "users_email_key":
			return auth.ErrEmailExists
		case "users_username_key":
			return auth.ErrUsernameExists
		}
	}
	return err
}
func insert(ctx context.Context, tx *sql.Tx, u auth.User) error {
	_, err := tx.ExecContext(ctx, `INSERT INTO users(id,full_name,email,username,password_hash,role,city,active,created_at) VALUES($1,$2,NULLIF($3,''),NULLIF($4,''),$5,$6,$7,$8,$9)`, u.ID, u.FullName, u.Email, u.Username, u.PasswordHash, u.Role, u.City, u.Active, u.CreatedAt)
	return conflict(err)
}
func (r *Postgres) Create(ctx context.Context, record domain.Record) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err = insert(ctx, tx, record.User); err != nil {
		return err
	}
	if record.Club != nil {
		_, err = tx.ExecContext(ctx, "INSERT INTO clubs(user_id,district,updated_at) VALUES($1,$2,$3)", record.User.ID, record.Club.District, record.Club.UpdatedAt)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}
func lock(ctx context.Context, tx *sql.Tx, id string) (auth.User, error) {
	var u auth.User
	err := tx.QueryRowContext(ctx, "SELECT id,role,active,COALESCE(email,''),COALESCE(username,'') FROM users WHERE id=$1 FOR UPDATE", id).Scan(&u.ID, &u.Role, &u.Active, &u.Email, &u.Username)
	if errors.Is(err, sql.ErrNoRows) {
		return u, auth.ErrNotFound
	}
	if err != nil {
		return u, err
	}
	if u.Role == "admin" {
		return u, domain.ErrProtected
	}
	return u, nil
}
func (r *Postgres) Update(ctx context.Context, record domain.Record) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	old, err := lock(ctx, tx, record.User.ID)
	if err != nil {
		return err
	}
	u := record.User
	// Roles cannot be changed through CRUD.
	_, err = tx.ExecContext(ctx, "UPDATE users SET full_name=$2,email=NULLIF($3,''),username=NULLIF($4,''),active=$5 WHERE id=$1", u.ID, u.FullName, u.Email, u.Username, u.Active)
	if err != nil {
		return conflict(err)
	}
	if old.Role == "club" && record.Club != nil {
		_, err = tx.ExecContext(ctx, "UPDATE clubs SET district=$2,updated_at=$3 WHERE user_id=$1", u.ID, record.Club.District, record.Club.UpdatedAt)
		if err != nil {
			return err
		}
	}
	if !u.Active || old.Email != u.Email || old.Username != u.Username {
		if _, err = tx.ExecContext(ctx, "UPDATE users SET auth_version=auth_version+1 WHERE id=$1", u.ID); err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, "DELETE FROM sessions WHERE user_id=$1", u.ID); err != nil {
			return err
		}
	}
	return tx.Commit()
}
func (r *Postgres) Delete(ctx context.Context, id string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = lock(ctx, tx, id); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, "DELETE FROM users WHERE id=$1", id); err != nil {
		return err
	}
	return tx.Commit()
}
func (r *Postgres) ResetPassword(ctx context.Context, id, hash string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = lock(ctx, tx, id); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, "UPDATE users SET password_hash=$2,auth_version=auth_version+1 WHERE id=$1", id, hash); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, "DELETE FROM sessions WHERE user_id=$1", id); err != nil {
		return err
	}
	return tx.Commit()
}
func (r *Postgres) Bootstrap(ctx context.Context, u auth.User) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "SELECT pg_advisory_xact_lock(721485190)"); err != nil {
		return err
	}
	var exists bool
	if err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE role='admin')").Scan(&exists); err != nil {
		return err
	}
	if exists {
		return domain.ErrAdminExists
	}
	if err = insert(ctx, tx, u); err != nil {
		return err
	}
	return tx.Commit()
}
