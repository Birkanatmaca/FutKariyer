-- +goose Up
-- Hesap güvenliği (20 Oct 2026). Accounts that exist today count as verified;
-- new self sign-ups verify their email with a 6-digit code once mail sending
-- is configured. Repeated wrong passwords slow one account down (no permanent
-- lock, so nobody can lock someone else out).
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
UPDATE users SET email_verified_at=now();
ALTER TABLE users ADD COLUMN failed_logins integer NOT NULL DEFAULT 0 CHECK (failed_logins >= 0);
ALTER TABLE users ADD COLUMN login_locked_until timestamptz;

-- One live code per account and purpose; only its hash is stored.
CREATE TABLE auth_codes (
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    code_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    sent_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, purpose)
);

-- Active sessions screen: when a session started, was last used and on what.
ALTER TABLE sessions ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE sessions ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE sessions ADD COLUMN device text NOT NULL DEFAULT '' CHECK (char_length(device) <= 80);

-- +goose Down
ALTER TABLE sessions DROP COLUMN device;
ALTER TABLE sessions DROP COLUMN last_seen_at;
ALTER TABLE sessions DROP COLUMN created_at;
DROP TABLE auth_codes;
ALTER TABLE users DROP COLUMN login_locked_until;
ALTER TABLE users DROP COLUMN failed_logins;
ALTER TABLE users DROP COLUMN email_verified_at;
