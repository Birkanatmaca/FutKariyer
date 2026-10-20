-- +goose Up
-- TFF Ankara link (20 Oct 2026): a club picks its own team in the public TFF
-- Ankara standings, so its home shows the next match, the table and the last
-- score from the federation's fixture. Season, league, group and team are set
-- together; the label keeps the option names for the profile screen.
ALTER TABLE clubs
    ADD COLUMN tff_season text NOT NULL DEFAULT '',
    ADD COLUMN tff_league text NOT NULL DEFAULT '',
    ADD COLUMN tff_group text NOT NULL DEFAULT '',
    ADD COLUMN tff_team text NOT NULL DEFAULT '',
    ADD COLUMN tff_label text NOT NULL DEFAULT '',
    ADD CONSTRAINT clubs_tff_link CHECK (
        (tff_season = '' AND tff_league = '' AND tff_group = '' AND tff_team = '' AND tff_label = '')
        OR (tff_season ~ '^[0-9]{1,10}$' AND tff_league ~ '^[0-9]{1,10}$' AND tff_group ~ '^[0-9]{0,10}$'
            AND char_length(tff_team) BETWEEN 1 AND 120 AND char_length(tff_label) <= 240)
    );

-- +goose Down
ALTER TABLE clubs
    DROP CONSTRAINT clubs_tff_link,
    DROP COLUMN tff_label,
    DROP COLUMN tff_team,
    DROP COLUMN tff_group,
    DROP COLUMN tff_league,
    DROP COLUMN tff_season;
