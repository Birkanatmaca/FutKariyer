-- +goose Up
-- Firebase Cloud Messaging device tokens. A token belongs to the signed-in
-- session that registered it, so signing out, session expiry or account
-- deletion removes it automatically.
CREATE TABLE push_devices (
    token text PRIMARY KEY CHECK (char_length(token) BETWEEN 1 AND 4096),
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_hash text NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
    platform text NOT NULL CHECK (platform IN ('ios', 'android')),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_devices_user ON push_devices(user_id);

-- In-app notifications are pushed once; existing rows count as delivered.
ALTER TABLE notifications ADD COLUMN pushed_at timestamptz;
UPDATE notifications SET pushed_at = created_at;
CREATE INDEX notifications_push_pending ON notifications(created_at, id) WHERE pushed_at IS NULL;

-- +goose Down
DROP INDEX notifications_push_pending;
ALTER TABLE notifications DROP COLUMN pushed_at;
DROP TABLE push_devices;
