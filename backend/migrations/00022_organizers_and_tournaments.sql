-- +goose Up
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('player','coach','club','admin','organizer'));
ALTER TABLE users DROP CONSTRAINT users_contact_check;
ALTER TABLE users ADD CONSTRAINT users_contact_check CHECK (role IN ('club','admin','organizer') OR email IS NOT NULL);
ALTER TABLE users DROP CONSTRAINT users_verified_role;
ALTER TABLE users ADD CONSTRAINT users_verified_role CHECK (NOT verified OR role IN ('club','coach','organizer'));

CREATE TABLE tournaments (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
 organizer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
 format text NOT NULL CHECK (format IN ('halisaha','seven_a_side','eleven_a_side')),
 eligible_types text[] NOT NULL CHECK (cardinality(eligible_types) BETWEEN 1 AND 3 AND eligible_types <@ ARRAY['amateur','professional','halisaha']::text[]),
 district text NOT NULL DEFAULT '' CHECK (char_length(district) <= 80),
 venue text NOT NULL DEFAULT '' CHECK (char_length(venue) <= 120),
 description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
 starts_on date NOT NULL,
 ends_on date NOT NULL,
 application_deadline date NOT NULL,
 team_capacity integer NOT NULL CHECK (team_capacity BETWEEN 2 AND 128),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','finished','cancelled')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (ends_on >= starts_on),
 CHECK (application_deadline <= starts_on)
);
CREATE INDEX tournaments_open ON tournaments(starts_on, id) WHERE status = 'open';
CREATE INDEX tournaments_organizer ON tournaments(organizer_id, created_at DESC);

CREATE TABLE tournament_entries (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
 tournament_id text NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
 club_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 message text NOT NULL DEFAULT '' CHECK (char_length(message) <= 300),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 decided_at timestamptz,
 UNIQUE (tournament_id, club_user_id)
);
CREATE INDEX tournament_entries_club ON tournament_entries(club_user_id, created_at DESC);

-- The roster a club sends with its entry, chosen from its squad.
CREATE TABLE tournament_entry_players (
 entry_id text NOT NULL REFERENCES tournament_entries(id) ON DELETE CASCADE,
 player_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY (entry_id, player_id)
);

ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('team_application','payment','opportunity','gift','game_reward','news_review','connection','tournament'));

-- +goose Down
DELETE FROM notifications WHERE kind = 'tournament';
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('team_application','payment','opportunity','gift','game_reward','news_review','connection'));
DROP TABLE tournament_entry_players;
DROP TABLE tournament_entries;
DROP TABLE tournaments;
-- Refuse to drop organizer accounts silently; rollback only succeeds when none exist.
ALTER TABLE users DROP CONSTRAINT users_verified_role;
ALTER TABLE users ADD CONSTRAINT users_verified_role CHECK (NOT verified OR role IN ('club','coach'));
ALTER TABLE users DROP CONSTRAINT users_contact_check;
ALTER TABLE users ADD CONSTRAINT users_contact_check CHECK (role IN ('club','admin') OR email IS NOT NULL);
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('player','coach','club','admin'));
