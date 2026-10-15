-- +goose Up
CREATE TABLE notifications (
    id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
    recipient_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('team_application','payment')),
    title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
    resource_id text NOT NULL CHECK (resource_id ~ '^[a-f0-9]{32}$'),
    source_key text NOT NULL CHECK (char_length(source_key) BETWEEN 1 AND 320),
    created_at timestamptz NOT NULL DEFAULT now(),
    read_at timestamptz,
    UNIQUE (recipient_id,source_key)
);

CREATE INDEX notifications_recipient_created ON notifications(recipient_id,created_at DESC,id DESC);
CREATE INDEX notifications_unread_recipient_created ON notifications(recipient_id,created_at DESC,id DESC) WHERE read_at IS NULL;

-- +goose Down
DROP TABLE notifications;
