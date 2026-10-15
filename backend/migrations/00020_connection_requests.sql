-- +goose Up
CREATE TABLE connection_requests (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
 sender_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipient_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 -- The pair is stored in a fixed order so a request in either direction maps to one pair.
 player_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 partner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 message text NOT NULL DEFAULT '' CHECK (char_length(message) <= 300),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 responded_at timestamptz,
 CHECK (sender_id <> recipient_id),
 CHECK ((sender_id = player_id AND recipient_id = partner_id) OR (sender_id = partner_id AND recipient_id = player_id)),
 CHECK ((status = 'pending') = (responded_at IS NULL))
);
CREATE UNIQUE INDEX connection_one_open_pair ON connection_requests(player_id, partner_id) WHERE status IN ('pending','accepted');
CREATE INDEX connection_recipient ON connection_requests(recipient_id, status, created_at DESC);
CREATE INDEX connection_sender ON connection_requests(sender_id, created_at DESC);

ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('team_application','payment','opportunity','gift','game_reward','news_review','connection'));

-- +goose Down
DELETE FROM notifications WHERE kind = 'connection';
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('team_application','payment','opportunity','gift','game_reward','news_review'));
DROP TABLE connection_requests;
