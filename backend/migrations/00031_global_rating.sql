-- +goose Up
-- Global rating (17 Oct 2026): monthly seasons set up by the administrator,
-- points from games and tasks, and daily play limits that replace hearts.

-- One row per account, game and Istanbul calendar day. Starting a new game
-- increments plays; the limit is enforced by the game service.
CREATE TABLE game_daily_plays (
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 game text NOT NULL CHECK (game IN ('football_guess','penalty','head_to_head')),
 day date NOT NULL,
 plays integer NOT NULL DEFAULT 0 CHECK (plays >= 0),
 PRIMARY KEY (user_id, game, day)
);

-- A season is a published window with prizes for the top three places.
-- Published seasons never overlap; the service checks it under a lock.
CREATE TABLE rating_seasons (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 80),
 description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 prizes jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(prizes) = 'array' AND jsonb_array_length(prizes) <= 3),
 published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (ends_at > starts_at)
);
CREATE INDEX rating_seasons_window ON rating_seasons(starts_at, ends_at) WHERE published;

-- Every point has a source and a reference (a run and question, a kick, a
-- task), so a retried answer or claim can never count twice.
CREATE TABLE rating_points (
 season_id text NOT NULL REFERENCES rating_seasons(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 source text NOT NULL CHECK (source IN ('football_guess','penalty','head_to_head','task')),
 ref text NOT NULL CHECK (char_length(ref) BETWEEN 1 AND 120),
 points integer NOT NULL CHECK (points > 0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (season_id, user_id, source, ref)
);
CREATE INDEX rating_points_board ON rating_points(season_id, user_id, created_at);

-- Built-in task kinds the server can measure; the administrator turns them
-- on and sets the goal and reward.
CREATE TABLE rating_tasks (
 kind text PRIMARY KEY CHECK (kind IN ('play_games','share_post','follow_accounts','h2h_streak')),
 active boolean NOT NULL DEFAULT false,
 target integer NOT NULL CHECK (target BETWEEN 1 AND 100),
 points integer NOT NULL CHECK (points BETWEEN 1 AND 1000),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO rating_tasks(kind, target, points) VALUES
 ('play_games', 10, 10),
 ('share_post', 1, 5),
 ('follow_accounts', 5, 5),
 ('h2h_streak', 5, 10);

-- +goose Down
DROP TABLE rating_tasks;
DROP TABLE rating_points;
DROP TABLE rating_seasons;
DROP TABLE game_daily_plays;
