-- +goose Up
-- Arma İzi history: which catalog players (Wikidata ids) a user has been
-- shown and when. New runs pick unseen players first, then the least
-- recently seen, so the large pool does not loop.
CREATE TABLE football_guess_seen (
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 question_id text NOT NULL CHECK (question_id ~ '^[A-Za-z0-9_-]{1,64}$'),
 seen_at timestamptz NOT NULL,
 times_seen integer NOT NULL DEFAULT 1 CHECK (times_seen >= 1),
 PRIMARY KEY (user_id, question_id)
);
CREATE INDEX football_guess_seen_recent ON football_guess_seen(user_id, seen_at);

-- +goose Down
DROP TABLE football_guess_seen;
