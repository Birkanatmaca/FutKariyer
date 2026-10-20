-- +goose Up
-- Popup ads (19 Oct 2026): one image shown over the app when it opens. The
-- format follows the uploaded image's exact size; the admin sets how many
-- minutes apart and how many times each account may see it.
CREATE TABLE popup_ads (
    id text PRIMARY KEY,
    title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
    image_id text NOT NULL REFERENCES content_images(id),
    format text NOT NULL CHECK (format IN ('square','portrait','story')),
    active boolean NOT NULL DEFAULT false,
    interval_minutes integer NOT NULL CHECK (interval_minutes BETWEEN 1 AND 43200),
    max_views integer NOT NULL CHECK (max_views BETWEEN 1 AND 100),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX popup_ads_active_idx ON popup_ads(updated_at DESC) WHERE active;

-- How often each account has seen a popup, for the interval and the cap.
CREATE TABLE popup_ad_views (
    popup_id text NOT NULL REFERENCES popup_ads(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    views integer NOT NULL CHECK (views >= 1),
    last_seen_at timestamptz NOT NULL,
    PRIMARY KEY (popup_id, user_id)
);
CREATE INDEX popup_ad_views_user_idx ON popup_ad_views(user_id);

-- +goose Down
DROP TABLE popup_ad_views;
DROP TABLE popup_ads;
