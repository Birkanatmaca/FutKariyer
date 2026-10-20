package data

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"

	"futcareer/backend/internal/account/domain"
	moderation "futcareer/backend/internal/moderation/data"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

const columns = `id,role,full_name,COALESCE(username,''),COALESCE(email,''),city,district,birth_date,bio,height_cm,weight_kg,avatar_version`
const member = `active AND role IN ('player','club','coach','organizer')`

type queryer interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func scan(row *sql.Row) (domain.Profile, error) {
	var p domain.Profile
	var birth sql.NullTime
	var height, weight sql.NullInt64
	err := row.Scan(&p.ID, &p.Role, &p.FullName, &p.Username, &p.Email, &p.City, &p.District, &birth, &p.Bio, &height, &weight, &p.AvatarVersion)
	if errors.Is(err, sql.ErrNoRows) {
		return p, domain.ErrForbidden
	}
	if err != nil {
		return p, err
	}
	if birth.Valid {
		at := birth.Time.UTC()
		p.BirthDate = &at
	}
	if height.Valid {
		v := int(height.Int64)
		p.HeightCm = &v
	}
	if weight.Valid {
		v := int(weight.Int64)
		p.WeightKg = &v
	}
	return p, nil
}

func load(ctx context.Context, q queryer, userID string) (domain.Profile, error) {
	return scan(q.QueryRowContext(ctx, `SELECT `+columns+` FROM users WHERE id=$1 AND `+member, userID))
}

func (r *Postgres) Profile(ctx context.Context, userID string) (domain.Profile, error) {
	return load(ctx, r.db, userID)
}

func nullInt(v *int) any {
	if v == nil {
		return nil
	}
	return *v
}

// SaveProfile updates the editable fields. An empty username keeps accounts
// that have none (players sign in with email) without one.
func (r *Postgres) SaveProfile(ctx context.Context, p domain.Profile) (domain.Profile, error) {
	var birth any
	if p.BirthDate != nil {
		birth = p.BirthDate.Format("2006-01-02")
	}
	out, err := scan(r.db.QueryRowContext(ctx, `UPDATE users SET full_name=$2,username=NULLIF($3,''),city=$4,district=$5,birth_date=$6::date,bio=$7,height_cm=$8,weight_kg=$9
		WHERE id=$1 AND `+member+` RETURNING `+columns,
		p.ID, p.FullName, p.Username, p.City, p.District, birth, p.Bio, nullInt(p.HeightCm), nullInt(p.WeightKg)))
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return out, domain.ErrUsernameTaken
	}
	return out, err
}

func (r *Postgres) SetAvatar(ctx context.Context, userID, mime string, data []byte) (domain.Profile, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Profile{}, err
	}
	defer tx.Rollback()
	if _, err = load(ctx, tx, userID); err != nil {
		return domain.Profile{}, err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO user_avatars(user_id,mime,size,data) VALUES($1,$2,$3,$4)
		ON CONFLICT(user_id) DO UPDATE SET mime=EXCLUDED.mime,size=EXCLUDED.size,data=EXCLUDED.data,updated_at=clock_timestamp()`,
		userID, mime, len(data), data); err != nil {
		return domain.Profile{}, err
	}
	out, err := scan(tx.QueryRowContext(ctx, `UPDATE users SET avatar_version=avatar_version+1 WHERE id=$1 RETURNING `+columns, userID))
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

func (r *Postgres) DeleteAvatar(ctx context.Context, userID string) (domain.Profile, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Profile{}, err
	}
	defer tx.Rollback()
	if _, err = load(ctx, tx, userID); err != nil {
		return domain.Profile{}, err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM user_avatars WHERE user_id=$1`, userID); err != nil {
		return domain.Profile{}, err
	}
	out, err := scan(tx.QueryRowContext(ctx, `UPDATE users SET avatar_version=0 WHERE id=$1 RETURNING `+columns, userID))
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

// Avatar is visible to every signed-in account (19 Oct 2026) of an active
// user, except across a block in either direction (20 Oct 2026).
func (r *Postgres) Avatar(ctx context.Context, viewerID, userID string) (domain.Avatar, error) {
	var a domain.Avatar
	err := r.db.QueryRowContext(ctx, `SELECT a.mime,a.data,a.updated_at FROM user_avatars a JOIN users u ON u.id=a.user_id WHERE a.user_id=$2 AND u.active AND `+moderation.NotBlocked("$1", "$2"), viewerID, userID).Scan(&a.MIME, &a.Data, &a.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return a, domain.ErrNotFound
	}
	return a, err
}
