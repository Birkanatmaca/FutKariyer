-- +goose Up
-- Yönetici iki aşamalı doğrulama (20 Oct 2026): the authenticator key is
-- sealed with ADMIN_TOTP_KEY (AES-GCM) before it is stored; totp_last_step
-- makes each code single-use. Recovery codes are stored as hashes.
ALTER TABLE users ADD COLUMN totp_secret bytea;
ALTER TABLE users ADD COLUMN totp_enabled_at timestamptz;
ALTER TABLE users ADD COLUMN totp_last_step bigint NOT NULL DEFAULT 0;

CREATE TABLE admin_recovery_codes (
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash text NOT NULL,
    used_at timestamptz,
    PRIMARY KEY (user_id, code_hash)
);

-- A password that matched waits here for its second factor (5 minutes).
-- pending_secret is set while the admin enrols an authenticator.
CREATE TABLE admin_challenges (
    token_hash text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pending_secret bytea,
    expires_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);
CREATE INDEX admin_challenges_expiry ON admin_challenges(expires_at);

-- Denetim kaydı: append-only. actor_id is not a foreign key so entries
-- outlive deleted accounts; rows can only be removed after two years.
CREATE TABLE audit_log (
    id bigserial PRIMARY KEY,
    at timestamptz NOT NULL DEFAULT now(),
    actor_type text NOT NULL CHECK (actor_type IN ('user', 'admin', 'system')),
    actor_id text,
    delegated_by text,
    action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 120),
    target_type text NOT NULL DEFAULT '',
    target_id text NOT NULL DEFAULT '',
    details jsonb NOT NULL DEFAULT '{}',
    ip inet,
    request_id text NOT NULL DEFAULT ''
);
CREATE INDEX audit_log_at ON audit_log(at DESC, id DESC);
CREATE INDEX audit_log_actor ON audit_log(actor_id, at DESC);
CREATE INDEX audit_log_action ON audit_log(action, at DESC);

-- +goose StatementBegin
CREATE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' AND OLD.at < now() - interval '2 years' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();

-- +goose Down
DROP TABLE audit_log;
DROP FUNCTION audit_log_append_only();
DROP TABLE admin_challenges;
DROP TABLE admin_recovery_codes;
ALTER TABLE users DROP COLUMN totp_last_step;
ALTER TABLE users DROP COLUMN totp_enabled_at;
ALTER TABLE users DROP COLUMN totp_secret;
