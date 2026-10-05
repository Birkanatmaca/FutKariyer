CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 full_name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK (role IN ('player','coach','club')),
 city TEXT NOT NULL DEFAULT 'Ankara',
 adult_confirmed INTEGER NOT NULL CHECK (adult_confirmed = 1),
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
