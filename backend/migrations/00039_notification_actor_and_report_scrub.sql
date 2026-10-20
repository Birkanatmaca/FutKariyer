-- +goose Up
-- Gizlilik (20 Oct 2026): notifications no longer store the name of the account
-- that caused them. Text holds the placeholder {actor}; the name is read from
-- actor_id when the notification is shown or pushed, so renames follow and a
-- deleted account reads "Silinmiş hesap" (actor_id becomes NULL).
ALTER TABLE notifications ADD COLUMN actor_id text REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX notifications_actor ON notifications(actor_id) WHERE actor_id IS NOT NULL;

-- Best-effort backfill where the actor is known and still exists.
UPDATE notifications n SET actor_id=u.id,
    title=replace(n.title, u.full_name, '{actor}'),
    body=replace(n.body, u.full_name, '{actor}')
FROM users u
WHERE n.kind IN ('follow', 'staff') AND u.id=n.resource_id
  AND (strpos(n.title, u.full_name) > 0 OR strpos(n.body, u.full_name) > 0);
UPDATE notifications n SET actor_id=u.id,
    body=replace(n.body, u.full_name, '{actor}')
FROM connection_requests c JOIN users u ON u.id=c.sender_id
WHERE n.kind='connection' AND n.source_key='connection:' || c.id || ':new' AND strpos(n.body, u.full_name) > 0;
UPDATE notifications n SET actor_id=u.id,
    body=replace(n.body, u.full_name, '{actor}')
FROM connection_requests c JOIN users u ON u.id=c.recipient_id
WHERE n.kind='connection' AND n.source_key='connection:' || c.id || ':accepted' AND strpos(n.body, u.full_name) > 0;
-- Follow notifications of accounts that are already gone.
UPDATE notifications n SET title='Silinmiş hesap'
WHERE n.kind='follow' AND n.actor_id IS NULL AND NOT EXISTS(SELECT 1 FROM users u WHERE u.id=n.resource_id);

-- Moderation reports keep their record and decision, but not a deleted
-- account's words: the excerpt goes with the reported account, the note with
-- the reporter. A trigger covers every deletion path (self, admin, demo).
UPDATE content_reports SET target_excerpt='' WHERE target_user_id IS NULL;
UPDATE content_reports SET note='' WHERE reporter_id IS NULL;

-- +goose StatementBegin
CREATE FUNCTION scrub_reports_of_deleted_user() RETURNS trigger AS $$
BEGIN
    UPDATE content_reports SET target_excerpt='' WHERE target_user_id=OLD.id;
    UPDATE content_reports SET note='' WHERE reporter_id=OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd
CREATE TRIGGER users_scrub_reports BEFORE DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION scrub_reports_of_deleted_user();

-- +goose Down
DROP TRIGGER users_scrub_reports ON users;
DROP FUNCTION scrub_reports_of_deleted_user();
UPDATE notifications n SET title=replace(n.title, '{actor}', COALESCE(u.full_name, 'Silinmiş hesap')),
    body=replace(n.body, '{actor}', COALESCE(u.full_name, 'Silinmiş hesap'))
FROM notifications m LEFT JOIN users u ON u.id=m.actor_id
WHERE m.id=n.id AND (strpos(n.title, '{actor}') > 0 OR strpos(n.body, '{actor}') > 0);
DROP INDEX notifications_actor;
ALTER TABLE notifications DROP COLUMN actor_id;
