-- +goose Up
ALTER TABLE social_posts DROP CONSTRAINT social_posts_body_check;
ALTER TABLE social_posts
    ADD COLUMN media_kind text NOT NULL DEFAULT '',
    ADD COLUMN media_mime text NOT NULL DEFAULT '',
    ADD COLUMN media_size integer NOT NULL DEFAULT 0,
    ADD COLUMN media_width integer NOT NULL DEFAULT 0,
    ADD COLUMN media_height integer NOT NULL DEFAULT 0,
    ADD COLUMN media_data bytea;
ALTER TABLE social_posts
    ADD CONSTRAINT social_posts_body_check CHECK (char_length(body) <= 500 AND (char_length(btrim(body)) > 0 OR media_kind <> '')),
    ADD CONSTRAINT social_posts_media_check CHECK (
        (media_kind = '' AND media_mime = '' AND media_data IS NULL AND media_size = 0 AND media_width = 0 AND media_height = 0)
        OR (media_kind = 'image' AND media_mime IN ('image/jpeg','image/png') AND media_data IS NOT NULL AND media_size = octet_length(media_data) AND media_size BETWEEN 1 AND 4194304 AND media_width BETWEEN 1 AND 8192 AND media_height BETWEEN 1 AND 8192 AND media_width::bigint * media_height <= 16000000)
        OR (media_kind = 'video' AND media_mime = 'video/mp4' AND media_data IS NOT NULL AND media_size = octet_length(media_data) AND media_size BETWEEN 1 AND 31457280 AND media_width = 0 AND media_height = 0)
    );

-- +goose Down
-- Media-only posts cannot survive the text-only schema rollback.
DELETE FROM social_posts WHERE char_length(btrim(body)) = 0;
ALTER TABLE social_posts DROP CONSTRAINT social_posts_media_check;
ALTER TABLE social_posts DROP CONSTRAINT social_posts_body_check;
ALTER TABLE social_posts DROP COLUMN media_kind, DROP COLUMN media_mime, DROP COLUMN media_size, DROP COLUMN media_width, DROP COLUMN media_height, DROP COLUMN media_data;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_body_check CHECK (char_length(btrim(body)) BETWEEN 1 AND 500);
