-- +goose Up
-- Follow notifications (18 Oct 2026): "X seni takip etmeye başladı", one per
-- follower and profile; resource_id is the follower's account id.
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('team_application','payment','opportunity','gift','game_reward','news_review','connection','tournament','follow'));

-- +goose Down
DELETE FROM notifications WHERE kind = 'follow';
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('team_application','payment','opportunity','gift','game_reward','news_review','connection','tournament'));
