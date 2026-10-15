-- +goose Up
-- Blocking: either side of a block stops seeing the other's posts, replies and
-- discovery profile, and new connection requests between them are refused.
CREATE TABLE user_blocks (
    blocker_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);
CREATE INDEX user_blocks_blocked ON user_blocks(blocked_id, blocker_id);

-- Reports of posts, replies and profiles for administrator review. The target
-- user is resolved by the server; a reporter reports one target once.
CREATE TABLE content_reports (
    id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
    reporter_id text REFERENCES users(id) ON DELETE SET NULL,
    target_kind text NOT NULL CHECK (target_kind IN ('post', 'reply', 'user')),
    target_id text NOT NULL CHECK (target_id ~ '^[a-f0-9]{32}$'),
    target_user_id text REFERENCES users(id) ON DELETE SET NULL,
    -- Kept so the review queue still shows what was reported after deletion.
    target_excerpt text NOT NULL DEFAULT '' CHECK (char_length(target_excerpt) <= 500),
    reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'impersonation', 'other')),
    note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'removed', 'suspended')),
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    CHECK ((status = 'open') = (resolved_at IS NULL)),
    UNIQUE (reporter_id, target_kind, target_id)
);
CREATE INDEX content_reports_status_created ON content_reports(status, created_at, id);
CREATE INDEX content_reports_reporter_created ON content_reports(reporter_id, created_at DESC);

-- +goose Down
DROP TABLE content_reports;
DROP TABLE user_blocks;
