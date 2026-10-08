package data

import (
	"context"
	"database/sql"
	"errors"

	"futcareer/backend/internal/players/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

func (r *Postgres) ProfileByUserID(ctx context.Context, userID string) (domain.Profile, error) {
	var profile domain.Profile
	err := r.db.QueryRowContext(ctx, `SELECT user_id,position,dominant_foot,experience_years,current_club,availability,discoverable,updated_at
		FROM player_profiles WHERE user_id=$1`, userID).Scan(
		&profile.UserID, &profile.Position, &profile.DominantFoot, &profile.ExperienceYears,
		&profile.CurrentClub, &profile.Availability, &profile.Discoverable, &profile.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Profile{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Profile{}, err
	}
	profile.UpdatedAt = profile.UpdatedAt.UTC()
	return profile, nil
}

func (r *Postgres) SaveProfile(ctx context.Context, profile domain.Profile) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO player_profiles
		(user_id,position,dominant_foot,experience_years,current_club,availability,discoverable,updated_at)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT(user_id) DO UPDATE SET position=excluded.position,dominant_foot=excluded.dominant_foot,
		experience_years=excluded.experience_years,current_club=excluded.current_club,availability=excluded.availability,
		discoverable=excluded.discoverable,updated_at=excluded.updated_at`,
		profile.UserID, profile.Position, profile.DominantFoot, profile.ExperienceYears,
		profile.CurrentClub, profile.Availability, profile.Discoverable, profile.UpdatedAt,
	)
	return err
}
