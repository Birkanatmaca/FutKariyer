-- +goose Up
-- Previously issued admin bearer sessions must not survive the portal change.
DELETE FROM sessions USING users WHERE sessions.user_id=users.id AND users.role='admin';
ALTER TABLE sessions ADD COLUMN audience TEXT NOT NULL DEFAULT 'mobile'
 CHECK (audience IN ('mobile','admin'));

-- +goose Down
-- Do not turn cookie sessions into mobile bearer sessions on rollback.
DELETE FROM sessions WHERE audience='admin';
ALTER TABLE sessions DROP COLUMN audience;
