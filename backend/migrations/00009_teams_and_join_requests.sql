-- +goose Up
ALTER TABLE clubs
    ADD COLUMN description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
    ADD COLUMN venue_name text NOT NULL DEFAULT '' CHECK (char_length(venue_name) <= 120),
    ADD COLUMN venue_address text NOT NULL DEFAULT '' CHECK (char_length(venue_address) <= 240),
    ADD COLUMN training_ground_name text NOT NULL DEFAULT '' CHECK (char_length(training_ground_name) <= 120),
    ADD COLUMN training_ground_address text NOT NULL DEFAULT '' CHECK (char_length(training_ground_address) <= 240),
    ADD COLUMN training_schedule text NOT NULL DEFAULT '' CHECK (char_length(training_schedule) <= 240);

CREATE TABLE team_join_requests (
    id text PRIMARY KEY,
    player_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Keep this target id after a team is deleted so it cannot refund a player's lifetime quota.
    club_user_id text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (player_id, club_user_id)
);

CREATE INDEX team_join_requests_club_status ON team_join_requests(club_user_id,status,created_at DESC,id DESC);
CREATE INDEX team_join_requests_player_history ON team_join_requests(player_id,created_at DESC,id DESC);

-- +goose Down
DROP TABLE team_join_requests;
ALTER TABLE clubs
    DROP COLUMN training_schedule,
    DROP COLUMN training_ground_address,
    DROP COLUMN training_ground_name,
    DROP COLUMN venue_address,
    DROP COLUMN venue_name,
    DROP COLUMN description;
