-- +goose Up
CREATE TABLE player_profiles (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 position TEXT NOT NULL DEFAULT '' CHECK (char_length(position) <= 40),
 dominant_foot TEXT NOT NULL DEFAULT '' CHECK (dominant_foot IN ('','right','left','both')),
 experience_years INTEGER NOT NULL DEFAULT 0 CHECK (experience_years BETWEEN 0 AND 60),
 current_club TEXT NOT NULL DEFAULT '' CHECK (char_length(current_club) <= 100),
 availability TEXT NOT NULL CHECK (availability IN ('seeking_team','open_to_offers','not_available')),
 discoverable BOOLEAN NOT NULL DEFAULT FALSE,
 updated_at TIMESTAMPTZ NOT NULL
);

-- +goose Down
DROP TABLE player_profiles;
