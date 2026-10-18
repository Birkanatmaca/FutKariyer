-- +goose Up
-- Profile posts (18 Oct 2026): a post with a photo or video can also be shown
-- in the author's profile Fotoğraflar/Videolar tabs. Text-only posts never are.
ALTER TABLE social_posts
    ADD COLUMN show_on_profile boolean NOT NULL DEFAULT false,
    ADD CONSTRAINT social_posts_profile_media_check CHECK (NOT show_on_profile OR media_kind <> '');
CREATE INDEX social_posts_author_page ON social_posts(author_id, created_at DESC, id DESC);

-- +goose Down
DROP INDEX social_posts_author_page;
ALTER TABLE social_posts
    DROP CONSTRAINT social_posts_profile_media_check,
    DROP COLUMN show_on_profile;
