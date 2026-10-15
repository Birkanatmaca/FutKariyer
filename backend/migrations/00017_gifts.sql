-- +goose Up
CREATE TABLE gifts (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
 kind text NOT NULL CHECK (kind IN ('heart_one','heart_full','application_right')),
 title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 80),
 message text NOT NULL DEFAULT '' CHECK (char_length(message) <= 500),
 audience text NOT NULL CHECK (audience IN ('all','account')),
 target_user_id text REFERENCES users(id) ON DELETE CASCADE,
 validity_days integer NOT NULL CHECK (validity_days BETWEEN 1 AND 365),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK ((audience='account') = (target_user_id IS NOT NULL))
);

CREATE TABLE user_gifts (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
 gift_id text NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 claimed_at timestamptz,
 CHECK (expires_at > created_at),
 UNIQUE (gift_id, user_id)
);
CREATE INDEX user_gifts_user_history ON user_gifts(user_id, created_at DESC, id DESC);

CREATE TABLE team_request_gift_rewards (
 user_gift_id text PRIMARY KEY REFERENCES user_gifts(id) ON DELETE RESTRICT,
 player_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 credits integer NOT NULL DEFAULT 1 CHECK (credits=1),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX team_request_gift_rewards_player ON team_request_gift_rewards(player_id);

-- +goose Down
DROP TABLE team_request_gift_rewards;
DROP TABLE user_gifts;
DROP TABLE gifts;
