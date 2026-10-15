-- +goose Up
-- Clubs and organizers can apply from the app; their account stays inactive until an administrator approves it.
ALTER TABLE users ADD COLUMN approval_status text NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved','pending','rejected'));
ALTER TABLE users ADD CONSTRAINT users_pending_inactive CHECK (approval_status = 'approved' OR NOT active);

CREATE TABLE account_applications (
 user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('club','organizer')),
 contact_name text NOT NULL CHECK (char_length(contact_name) BETWEEN 2 AND 80),
 phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 30),
 district text NOT NULL DEFAULT '' CHECK (char_length(district) <= 80),
 note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
 submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 decided_at timestamptz,
 rejection_reason text NOT NULL DEFAULT '' CHECK (char_length(rejection_reason) <= 300)
);
CREATE INDEX account_applications_pending ON account_applications(submitted_at) WHERE decided_at IS NULL;

-- +goose Down
DROP TABLE account_applications;
ALTER TABLE users DROP CONSTRAINT users_pending_inactive;
ALTER TABLE users DROP COLUMN approval_status;
