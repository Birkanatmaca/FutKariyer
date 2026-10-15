-- +goose Up
CREATE TABLE game_wallets (
 user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 hearts integer NOT NULL DEFAULT 3 CHECK (hearts BETWEEN 0 AND 3),
 refill_anchor timestamptz,
 CHECK ((hearts = 3 AND refill_anchor IS NULL) OR (hearts < 3 AND refill_anchor IS NOT NULL))
);

CREATE TABLE football_guess_runs (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished')),
 questions jsonb NOT NULL CHECK (jsonb_typeof(questions)='array' AND jsonb_array_length(questions)=10),
 answers jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(answers)='array' AND jsonb_array_length(answers)<=10),
 score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 10),
 reward_granted boolean NOT NULL DEFAULT false,
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 finished_at timestamptz,
 CHECK ((status='active' AND finished_at IS NULL AND jsonb_array_length(answers)<10) OR (status='finished' AND finished_at IS NOT NULL AND jsonb_array_length(answers)=10)),
 CHECK (NOT reward_granted OR (status='finished' AND score>=7))
);
CREATE UNIQUE INDEX football_guess_one_active ON football_guess_runs(user_id) WHERE status='active';
CREATE INDEX football_guess_user_history ON football_guess_runs(user_id,started_at DESC,id DESC);

CREATE TABLE team_request_game_rewards (
 run_id text PRIMARY KEY REFERENCES football_guess_runs(id) ON DELETE RESTRICT,
 player_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 credits integer NOT NULL DEFAULT 1 CHECK (credits=1),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX team_request_game_rewards_player ON team_request_game_rewards(player_id);

-- +goose Down
DROP TABLE team_request_game_rewards;
DROP TABLE football_guess_runs;
DROP TABLE game_wallets;
