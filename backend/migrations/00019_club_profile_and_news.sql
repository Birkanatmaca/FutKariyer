-- +goose Up
ALTER TABLE news_articles
 ADD COLUMN author_user_id text REFERENCES users(id) ON DELETE CASCADE,
 ADD COLUMN review_status text NOT NULL DEFAULT 'approved' CHECK (review_status IN ('pending','approved','rejected'));
CREATE INDEX news_author ON news_articles(author_user_id, created_at DESC, id DESC) WHERE author_user_id IS NOT NULL;

ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('team_application','payment','opportunity','gift','game_reward','news_review'));

-- +goose Down
DELETE FROM notifications WHERE kind = 'news_review';
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('team_application','payment','opportunity','gift','game_reward'));
DROP INDEX news_author;
ALTER TABLE news_articles DROP COLUMN review_status, DROP COLUMN author_user_id;
