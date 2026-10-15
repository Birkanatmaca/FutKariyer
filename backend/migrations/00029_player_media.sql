-- +goose Up
-- Player profile gallery: photos and videos the athlete uploads, stored in
-- PostgreSQL like social media (no external storage provider). Visibility
-- follows the profile's discovery rules and blocks.
CREATE TABLE player_media (
    id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
    owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('image', 'video')),
    mime text NOT NULL,
    size integer NOT NULL,
    width integer NOT NULL DEFAULT 0,
    height integer NOT NULL DEFAULT 0,
    data bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CHECK (size = octet_length(data)),
    CHECK (
        (kind = 'image' AND mime IN ('image/jpeg', 'image/png') AND size BETWEEN 1 AND 4194304
            AND width BETWEEN 1 AND 8192 AND height BETWEEN 1 AND 8192 AND width::bigint * height <= 16000000)
        OR (kind = 'video' AND mime = 'video/mp4' AND size BETWEEN 1 AND 31457280 AND width = 0 AND height = 0)
    )
);
CREATE INDEX player_media_owner_kind ON player_media(owner_id, kind, created_at DESC, id DESC);

-- +goose Down
DROP TABLE player_media;
