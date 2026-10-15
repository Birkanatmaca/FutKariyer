-- +goose Up
-- Kafa Kafaya runs. Rounds (with their hidden values) stay on the server; the
-- free game grants no reward, so only the streak and play count are kept.
CREATE TABLE head_to_head_runs (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished')),
 streak integer NOT NULL DEFAULT 0 CHECK (streak >= 0),
 rounds jsonb NOT NULL CHECK (jsonb_typeof(rounds)='array' AND jsonb_array_length(rounds) >= 1),
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 finished_at timestamptz,
 CHECK ((status='active') = (finished_at IS NULL))
);
CREATE UNIQUE INDEX head_to_head_one_active ON head_to_head_runs(user_id) WHERE status='active';
CREATE INDEX head_to_head_user_history ON head_to_head_runs(user_id,started_at DESC,id DESC);

-- +goose Down
DROP TABLE head_to_head_runs;
