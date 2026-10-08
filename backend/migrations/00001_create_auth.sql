-- +goose Up
CREATE TABLE users (
 id TEXT PRIMARY KEY,
 full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 80),
 email TEXT NOT NULL CONSTRAINT users_email_key UNIQUE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK (role IN ('player','coach','club')),
 city TEXT NOT NULL DEFAULT 'Ankara',
 adult_confirmed BOOLEAN NOT NULL CHECK (adult_confirmed),
 created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE INDEX sessions_user ON sessions(user_id);

-- +goose Down
DROP TABLE sessions;
DROP TABLE users;
