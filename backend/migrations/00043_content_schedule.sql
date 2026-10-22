-- +goose Up
-- Content scheduling (21 Oct 2026): news and banner ads get a publishing
-- window and how many seconds each one stays on screen in the app's
-- carousel; news also get a priority (lower first). Popups get the same
-- window. A missing start or end leaves that side open.
ALTER TABLE news_articles
    ADD COLUMN sort_order integer NOT NULL DEFAULT 100 CHECK (sort_order BETWEEN 0 AND 10000),
    ADD COLUMN display_seconds integer NOT NULL DEFAULT 6 CHECK (display_seconds BETWEEN 3 AND 30),
    ADD COLUMN starts_at timestamptz,
    ADD COLUMN ends_at timestamptz,
    ADD CONSTRAINT news_articles_window CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);
ALTER TABLE advertisements
    ADD COLUMN display_seconds integer NOT NULL DEFAULT 5 CHECK (display_seconds BETWEEN 3 AND 30),
    ADD COLUMN starts_at timestamptz,
    ADD COLUMN ends_at timestamptz,
    ADD CONSTRAINT advertisements_window CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);
ALTER TABLE popup_ads
    ADD COLUMN starts_at timestamptz,
    ADD COLUMN ends_at timestamptz,
    ADD CONSTRAINT popup_ads_window CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);

-- +goose Down
ALTER TABLE popup_ads DROP CONSTRAINT popup_ads_window, DROP COLUMN ends_at, DROP COLUMN starts_at;
ALTER TABLE advertisements DROP CONSTRAINT advertisements_window, DROP COLUMN ends_at, DROP COLUMN starts_at, DROP COLUMN display_seconds;
ALTER TABLE news_articles DROP CONSTRAINT news_articles_window, DROP COLUMN ends_at, DROP COLUMN starts_at, DROP COLUMN display_seconds, DROP COLUMN sort_order;
