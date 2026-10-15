-- +goose Up
CREATE TABLE social_posts (
    id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
    author_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_posts_created ON social_posts(created_at DESC,id DESC);
CREATE INDEX social_posts_author_created ON social_posts(author_id,created_at DESC);

CREATE TABLE social_likes (
    post_id text NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id,user_id)
);
CREATE INDEX social_likes_user ON social_likes(user_id);

CREATE TABLE social_replies (
    id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
    post_id text NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    author_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_replies_post_created ON social_replies(post_id,created_at DESC,id DESC);
CREATE INDEX social_replies_author_created ON social_replies(author_id,created_at DESC);

CREATE TABLE social_write_limits (
    user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_post_at timestamptz,
    last_reply_at timestamptz
);

-- +goose Down
DROP TABLE social_write_limits;
DROP TABLE social_replies;
DROP TABLE social_likes;
DROP TABLE social_posts;
