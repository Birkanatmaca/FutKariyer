-- +goose Up
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('team_application','payment','opportunity','gift','game_reward'));

CREATE TABLE announcements (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
 kind text NOT NULL DEFAULT 'opportunity' CHECK (kind IN ('opportunity')),
 title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
 body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
 audience text NOT NULL CHECK (audience IN ('all','player','club','coach','account')),
 target_user_id text REFERENCES users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK ((audience='account') = (target_user_id IS NOT NULL))
);
CREATE INDEX announcements_created ON announcements(created_at DESC, id DESC);

-- +goose Down
DROP TABLE announcements;
DELETE FROM notifications WHERE kind IN ('opportunity','gift','game_reward');
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('team_application','payment'));
