-- +goose Up
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('player','coach','club','admin'));
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN username TEXT CONSTRAINT users_username_key UNIQUE;
ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD CONSTRAINT users_username_format CHECK (username IS NULL OR username ~ '^[a-z0-9._-]{3,32}$');
ALTER TABLE users ADD CONSTRAINT users_contact_check CHECK (role IN ('club','admin') OR email IS NOT NULL);
CREATE INDEX users_page_order ON users(created_at DESC, id DESC);

CREATE TABLE clubs (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 district TEXT NOT NULL DEFAULT '' CHECK (char_length(district) <= 80),
 updated_at TIMESTAMPTZ NOT NULL
);
-- Preserve previously registered club accounts.
INSERT INTO clubs(user_id, updated_at) SELECT id, created_at FROM users WHERE role = 'club';

-- +goose Down
-- Refuse to remove credentials or reactivate accounts during rollback.
-- +goose StatementBegin
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM users WHERE role = 'admin' OR email IS NULL OR username IS NOT NULL OR NOT active) THEN
  RAISE EXCEPTION 'Admin/username accounts or suspended users exist; migrate their data before rollback';
 END IF;
END $$;
-- +goose StatementEnd
DROP TABLE clubs;
DROP INDEX users_page_order;
ALTER TABLE sessions DROP COLUMN auth_version;
ALTER TABLE users DROP COLUMN auth_version;
ALTER TABLE users DROP CONSTRAINT users_contact_check;
ALTER TABLE users DROP COLUMN active;
ALTER TABLE users DROP COLUMN username;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('player','coach','club'));
