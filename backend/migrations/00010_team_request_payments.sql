-- +goose Up
CREATE TABLE team_request_packages (
    id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
    credits integer NOT NULL CHECK (credits IN (2,5,10)),
    amount_minor bigint NOT NULL CHECK (amount_minor > 0),
    currency text NOT NULL DEFAULT 'TRY' CHECK (currency ~ '^[A-Z]{3}$'),
    active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (credits)
);

INSERT INTO team_request_packages(id,credits,amount_minor,currency,sort_order) VALUES
    ('00000000000000000000000000000002',2,10000,'TRY',1),
    ('00000000000000000000000000000005',5,20000,'TRY',2),
    ('00000000000000000000000000000010',10,30000,'TRY',3);

CREATE TABLE team_request_payments (
    id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
    player_id text REFERENCES users(id) ON DELETE SET NULL,
    package_id text REFERENCES team_request_packages(id) ON DELETE SET NULL,
    package_credits integer NOT NULL CHECK (package_credits IN (2,5,10)),
    amount_minor bigint NOT NULL CHECK (amount_minor > 0),
    currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    provider text NOT NULL DEFAULT '' CHECK (char_length(provider) <= 80),
    provider_payment_id text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    confirmed_at timestamptz,
    UNIQUE (provider,provider_payment_id)
);

CREATE INDEX team_request_payments_status_created ON team_request_payments(status,created_at DESC,id DESC);
CREATE INDEX team_request_payments_player_created ON team_request_payments(player_id,created_at DESC,id DESC);

CREATE TABLE team_request_payment_events (
    provider text NOT NULL,
    event_id text NOT NULL,
    order_id text NOT NULL REFERENCES team_request_payments(id) ON DELETE CASCADE,
    received_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider,event_id)
);

-- +goose Down
DROP TABLE team_request_payment_events;
DROP TABLE team_request_payments;
DROP TABLE team_request_packages;
