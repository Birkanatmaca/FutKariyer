-- +goose Up
ALTER TABLE player_profiles
 ADD COLUMN football_type TEXT NOT NULL DEFAULT 'unknown'
 CHECK (football_type IN ('unknown','amateur','professional','halisaha')),
 ADD COLUMN license_status TEXT NOT NULL DEFAULT 'unknown'
 CHECK (license_status IN ('unknown','licensed','unlicensed'));

ALTER TABLE clubs
 ADD COLUMN football_type TEXT NOT NULL DEFAULT 'unknown'
 CHECK (football_type IN ('unknown','amateur','professional','halisaha'));

-- +goose Down
ALTER TABLE clubs DROP COLUMN football_type;
ALTER TABLE player_profiles DROP COLUMN license_status, DROP COLUMN football_type;
