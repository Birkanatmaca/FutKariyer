-- +goose Up
-- Organizers can invite teams (22 Oct 2026). An invited entry waits for the
-- club to pick a roster and accept, or to decline.
ALTER TABLE tournament_entries DROP CONSTRAINT tournament_entries_status_check;
ALTER TABLE tournament_entries ADD CONSTRAINT tournament_entries_status_check CHECK (status IN ('pending','accepted','rejected','withdrawn','invited','declined'));
ALTER TABLE tournament_entries ADD CONSTRAINT tournament_entries_id_tournament UNIQUE (id, tournament_id);

-- Fixture and results the organizer keeps; standings are computed from them.
CREATE TABLE tournament_matches (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
 tournament_id text NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
 round integer NOT NULL CHECK (round BETWEEN 1 AND 300),
 home_entry_id text NOT NULL,
 away_entry_id text NOT NULL,
 kickoff_at timestamptz,
 venue text NOT NULL DEFAULT '' CHECK (char_length(venue) <= 120),
 home_goals integer,
 away_goals integer,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (home_entry_id <> away_entry_id),
 CHECK ((home_goals IS NULL AND away_goals IS NULL) OR (home_goals BETWEEN 0 AND 99 AND away_goals BETWEEN 0 AND 99)),
 FOREIGN KEY (home_entry_id, tournament_id) REFERENCES tournament_entries(id, tournament_id) ON DELETE CASCADE,
 FOREIGN KEY (away_entry_id, tournament_id) REFERENCES tournament_entries(id, tournament_id) ON DELETE CASCADE
);
CREATE INDEX tournament_matches_schedule ON tournament_matches(tournament_id, round, kickoff_at, id);

-- A club can invite a player into its squad; the player accepts or declines.
CREATE TABLE club_squad_invites (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
 club_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 player_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 message text NOT NULL DEFAULT '' CHECK (char_length(message) <= 300),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 decided_at timestamptz,
 CHECK ((status = 'pending') = (decided_at IS NULL))
);
CREATE UNIQUE INDEX club_squad_invites_open ON club_squad_invites(club_user_id, player_id) WHERE status = 'pending';
CREATE INDEX club_squad_invites_player ON club_squad_invites(player_id, created_at DESC);

ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('team_application','payment','opportunity','gift','game_reward','news_review','connection','tournament','follow','staff','squad_invite'));

-- +goose Down
DELETE FROM notifications WHERE kind = 'squad_invite';
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('team_application','payment','opportunity','gift','game_reward','news_review','connection','tournament','follow','staff'));
DROP TABLE club_squad_invites;
DROP TABLE tournament_matches;
ALTER TABLE tournament_entries DROP CONSTRAINT tournament_entries_id_tournament;
UPDATE tournament_entries SET status = 'withdrawn' WHERE status IN ('invited','declined');
ALTER TABLE tournament_entries DROP CONSTRAINT tournament_entries_status_check;
ALTER TABLE tournament_entries ADD CONSTRAINT tournament_entries_status_check CHECK (status IN ('pending','accepted','rejected','withdrawn'));
