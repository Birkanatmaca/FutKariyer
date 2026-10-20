-- +goose Up
-- Sistem logları (20 Oct 2026): the log lines worth keeping, readable and
-- manageable in the admin panel: errors, warnings, security events, app
-- error reports, slow requests and queries, and (when switched on) every
-- request. Lines carry ids and masked IPs, never personal data.
CREATE TABLE system_logs (
    id bigserial PRIMARY KEY,
    at timestamptz NOT NULL,
    level text NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
    event text NOT NULL,
    request_id text NOT NULL DEFAULT '',
    method text NOT NULL DEFAULT '',
    route text NOT NULL DEFAULT '',
    status integer NOT NULL DEFAULT 0,
    duration_ms integer NOT NULL DEFAULT 0,
    user_id text NOT NULL DEFAULT '',
    account_type text NOT NULL DEFAULT '',
    ip text NOT NULL DEFAULT '',
    client text NOT NULL DEFAULT '',
    app_version text NOT NULL DEFAULT '',
    version text NOT NULL DEFAULT '',
    security boolean NOT NULL DEFAULT false,
    message text NOT NULL DEFAULT '',
    attrs jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX system_logs_at ON system_logs(at DESC, id DESC);
CREATE INDEX system_logs_level_at ON system_logs(level, at DESC);
CREATE INDEX system_logs_event_at ON system_logs(event, at DESC);
CREATE INDEX system_logs_request ON system_logs(request_id) WHERE request_id <> '';
CREATE INDEX system_logs_user ON system_logs(user_id, at DESC) WHERE user_id <> '';
CREATE INDEX system_logs_security ON system_logs(at DESC) WHERE security;

-- One row: what is logged and kept, changed from the admin panel.
CREATE TABLE log_settings (
    id boolean PRIMARY KEY DEFAULT true CHECK (id),
    level text NOT NULL DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
    store_requests boolean NOT NULL DEFAULT false,
    request_days integer NOT NULL DEFAULT 7 CHECK (request_days BETWEEN 1 AND 90),
    problem_days integer NOT NULL DEFAULT 90 CHECK (problem_days BETWEEN 7 AND 365),
    security_days integer NOT NULL DEFAULT 365 CHECK (security_days BETWEEN 30 AND 730),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text
);
INSERT INTO log_settings DEFAULT VALUES;

-- +goose Down
DROP TABLE log_settings;
DROP TABLE system_logs;
