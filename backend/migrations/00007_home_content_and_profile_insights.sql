-- +goose Up
CREATE TABLE content_images (
    id text PRIMARY KEY,
    mime text NOT NULL CHECK (mime IN ('image/jpeg','image/png')),
    data bytea NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 4194304),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE advertisements (
    id text PRIMARY KEY,
    title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
    image_id text NOT NULL REFERENCES content_images(id),
    active boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 10000),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE news_articles (
    id text PRIMARY KEY,
    title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
    summary text NOT NULL CHECK (char_length(summary) BETWEEN 2 AND 300),
    body text NOT NULL CHECK (char_length(body) BETWEEN 2 AND 20000),
    image_id text REFERENCES content_images(id),
    published boolean NOT NULL DEFAULT false,
    show_on_home boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX news_published ON news_articles(created_at DESC,id DESC) WHERE published;
CREATE TABLE profile_views (
    profile_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
    PRIMARY KEY (profile_id,viewer_id,viewed_on),
    CHECK (profile_id <> viewer_id)
);
CREATE TABLE profile_follows (
    profile_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    follower_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (profile_id,follower_id),
    CHECK (profile_id <> follower_id)
);
CREATE INDEX profile_follows_follower ON profile_follows(follower_id);

-- +goose Down
DROP TABLE profile_follows;
DROP TABLE profile_views;
DROP TABLE news_articles;
DROP TABLE advertisements;
DROP TABLE content_images;
