-- +goose Up
ALTER TABLE users ADD COLUMN verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD CONSTRAINT users_verified_role CHECK (NOT verified OR role IN ('club','coach'));
CREATE INDEX users_discovery_order ON users(role, created_at DESC, id DESC) WHERE active;
CREATE INDEX player_profiles_discoverable ON player_profiles(user_id) WHERE discoverable;

-- +goose Down
DROP INDEX player_profiles_discoverable;
DROP INDEX users_discovery_order;
ALTER TABLE users DROP COLUMN verified;
