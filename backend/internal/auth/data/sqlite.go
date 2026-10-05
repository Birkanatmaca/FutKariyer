package data

import (
	"context"
	"database/sql"
	_ "embed"
	"errors"
	"os"
	"path/filepath"
	"time"

	"futcareer/backend/internal/auth/domain"
	"modernc.org/sqlite"
)

//go:embed schema.sql
var schema string

type SQLite struct{ db *sql.DB }

func Open(path string) (*SQLite, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	for _, statement := range []string{"PRAGMA foreign_keys=ON", "PRAGMA busy_timeout=5000", "PRAGMA journal_mode=WAL", schema} {
		if _, err = db.Exec(statement); err != nil {
			db.Close()
			return nil, err
		}
	}
	if _, err = db.Exec("DELETE FROM sessions WHERE expires_at <= ?", time.Now().Unix()); err != nil {
		db.Close()
		return nil, err
	}
	return &SQLite{db: db}, nil
}
func (r *SQLite) Close() error { return r.db.Close() }
func (r *SQLite) Register(ctx context.Context, u domain.User, s domain.Session) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, "INSERT INTO users(id,full_name,email,password_hash,role,city,adult_confirmed,created_at) VALUES(?,?,?,?,?,?,?,?)", u.ID, u.FullName, u.Email, u.PasswordHash, u.Role, u.City, u.AdultConfirmed, u.CreatedAt.Unix())
	if err != nil {
		var sqliteErr *sqlite.Error
		if errors.As(err, &sqliteErr) && sqliteErr.Code() == 2067 {
			return domain.ErrEmailExists
		}
		return err
	}
	if _, err = tx.ExecContext(ctx, "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)", s.TokenHash, s.UserID, s.ExpiresAt.Unix()); err != nil {
		return err
	}
	return tx.Commit()
}
func scanUser(row *sql.Row) (domain.User, error) {
	var u domain.User
	var created int64
	err := row.Scan(&u.ID, &u.FullName, &u.Email, &u.PasswordHash, &u.Role, &u.City, &u.AdultConfirmed, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return u, domain.ErrNotFound
	}
	u.CreatedAt = time.Unix(created, 0).UTC()
	return u, err
}

const columns = "id,full_name,email,password_hash,role,city,adult_confirmed,created_at"

func (r *SQLite) UserByEmail(ctx context.Context, email string) (domain.User, error) {
	return scanUser(r.db.QueryRowContext(ctx, "SELECT "+columns+" FROM users WHERE email=?", email))
}
func (r *SQLite) UserByID(ctx context.Context, id string) (domain.User, error) {
	return scanUser(r.db.QueryRowContext(ctx, "SELECT "+columns+" FROM users WHERE id=?", id))
}
func (r *SQLite) CreateSession(ctx context.Context, s domain.Session) error {
	_, err := r.db.ExecContext(ctx, "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)", s.TokenHash, s.UserID, s.ExpiresAt.Unix())
	return err
}
func (r *SQLite) SessionByHash(ctx context.Context, hash string) (domain.Session, error) {
	var s domain.Session
	var expiry int64
	err := r.db.QueryRowContext(ctx, "SELECT token_hash,user_id,expires_at FROM sessions WHERE token_hash=?", hash).Scan(&s.TokenHash, &s.UserID, &expiry)
	if errors.Is(err, sql.ErrNoRows) {
		return s, domain.ErrNotFound
	}
	s.ExpiresAt = time.Unix(expiry, 0).UTC()
	return s, err
}
func (r *SQLite) DeleteSession(ctx context.Context, hash string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM sessions WHERE token_hash=?", hash)
	return err
}
