-- +goose Up
-- When the account holder accepted the terms of use and the KVKK notice
-- (23 Oct 2026). NULL for accounts created earlier or by administrators.
ALTER TABLE users ADD COLUMN terms_accepted_at timestamptz;

-- One-to-one messages (23 Oct 2026) between accepted connections and between
-- a club and its squad players. user_a < user_b keeps one row per pair.
CREATE TABLE conversations (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
 user_a text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 user_b text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_message_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 a_read_at timestamptz,
 b_read_at timestamptz,
 CHECK (user_a < user_b),
 UNIQUE (user_a, user_b)
);
CREATE INDEX conversations_a ON conversations(user_a, last_message_at DESC);
CREATE INDEX conversations_b ON conversations(user_b, last_message_at DESC);

CREATE TABLE messages (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
 conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 sender_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX messages_conversation ON messages(conversation_id, created_at DESC, id DESC);

ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('team_application','payment','opportunity','gift','game_reward','news_review','connection','tournament','follow','staff','squad_invite','message'));

-- +goose Down
DELETE FROM notifications WHERE kind = 'message';
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('team_application','payment','opportunity','gift','game_reward','news_review','connection','tournament','follow','staff','squad_invite'));
DROP TABLE messages;
DROP TABLE conversations;
ALTER TABLE users DROP COLUMN terms_accepted_at;
