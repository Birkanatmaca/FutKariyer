-- +goose Up
CREATE TABLE penalty_shootouts (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished')),
 kicks jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(kicks)='array'),
 winner text CHECK (winner IN ('user','cpu')),
 reward_granted boolean NOT NULL DEFAULT false,
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 finished_at timestamptz,
 CHECK ((status='active' AND winner IS NULL AND finished_at IS NULL) OR (status='finished' AND winner IS NOT NULL AND finished_at IS NOT NULL)),
 CHECK (NOT reward_granted OR (status='finished' AND winner='user'))
);
CREATE UNIQUE INDEX penalty_shootout_one_active ON penalty_shootouts(user_id) WHERE status='active';
CREATE INDEX penalty_shootout_user_history ON penalty_shootouts(user_id,started_at DESC,id DESC);

CREATE TABLE team_request_penalty_rewards (
 shootout_id text PRIMARY KEY REFERENCES penalty_shootouts(id) ON DELETE RESTRICT,
 player_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 credits integer NOT NULL DEFAULT 1 CHECK (credits=1),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX team_request_penalty_rewards_player ON team_request_penalty_rewards(player_id);

-- +goose Down
DROP TABLE team_request_penalty_rewards;
DROP TABLE penalty_shootouts;
