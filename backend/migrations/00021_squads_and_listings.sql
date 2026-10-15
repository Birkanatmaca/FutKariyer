-- +goose Up
-- A squad member is a player whose team application the club accepted.
CREATE TABLE club_squad_members (
 club_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 player_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_id text,
 joined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 left_at timestamptz,
 PRIMARY KEY (club_user_id, player_id),
 CHECK (left_at IS NULL OR left_at >= joined_at)
);
CREATE INDEX club_squad_active ON club_squad_members(club_user_id, joined_at DESC) WHERE left_at IS NULL;
CREATE INDEX club_squad_player ON club_squad_members(player_id) WHERE left_at IS NULL;
INSERT INTO club_squad_members(club_user_id, player_id, request_id, joined_at)
 SELECT q.club_user_id, q.player_id, q.id, q.updated_at FROM team_join_requests q
 JOIN clubs c ON c.user_id = q.club_user_id
 WHERE q.status = 'accepted'
 ON CONFLICT DO NOTHING;

CREATE TABLE club_listings (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
 club_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
 position text NOT NULL DEFAULT '' CHECK (char_length(position) <= 40),
 description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 closed_at timestamptz,
 CHECK ((status = 'open') = (closed_at IS NULL))
);
CREATE INDEX club_listings_open ON club_listings(created_at DESC, id DESC) WHERE status = 'open';
CREATE INDEX club_listings_club ON club_listings(club_user_id, created_at DESC);

ALTER TABLE team_join_requests ADD COLUMN listing_id text REFERENCES club_listings(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE team_join_requests DROP COLUMN listing_id;
DROP TABLE club_listings;
DROP TABLE club_squad_members;
