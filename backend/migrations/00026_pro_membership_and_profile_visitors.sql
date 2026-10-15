-- +goose Up
-- Profile visitors: one row per viewer and UTC day stays the unit of counting;
-- the last view time and the private browsing flag are kept for the visitors list.
ALTER TABLE profile_views
    ADD COLUMN last_viewed_at timestamptz,
    ADD COLUMN private boolean NOT NULL DEFAULT false;
UPDATE profile_views SET last_viewed_at = viewed_on::timestamp AT TIME ZONE 'UTC';
ALTER TABLE profile_views
    ALTER COLUMN last_viewed_at SET DEFAULT now(),
    ALTER COLUMN last_viewed_at SET NOT NULL;
CREATE INDEX profile_views_profile_day ON profile_views(profile_id, viewed_on DESC);

-- A single Pro plan: 30 days and +3 team application rights per paid period.
-- The administrator manages its price and on-sale state like the right packages.
CREATE TABLE pro_plans (
    id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
    days integer NOT NULL CHECK (days = 30),
    bonus_credits integer NOT NULL CHECK (bonus_credits = 3),
    amount_minor bigint NOT NULL CHECK (amount_minor > 0),
    currency text NOT NULL DEFAULT 'TRY' CHECK (currency ~ '^[A-Z]{3}$'),
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO pro_plans(id, days, bonus_credits, amount_minor, currency)
VALUES ('000000000000000000000000000a0030', 30, 3, 4900, 'TRY');

-- Pro orders share the provider-independent order, webhook and event tables.
ALTER TABLE team_request_payments
    ADD COLUMN product text NOT NULL DEFAULT 'team_rights' CHECK (product IN ('team_rights', 'pro')),
    ADD COLUMN pro_plan_id text REFERENCES pro_plans(id) ON DELETE SET NULL,
    DROP CONSTRAINT team_request_payments_package_credits_check,
    ADD CONSTRAINT team_request_payments_product_credits CHECK (
        (product = 'team_rights' AND package_credits IN (2, 5, 10)) OR (product = 'pro' AND package_credits = 0)
    );

CREATE TABLE pro_memberships (
    user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    private_browsing boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pro_memberships_expires ON pro_memberships(expires_at);

-- Every paid or manually granted period; the unique payment id makes webhook
-- activation (and its +3 rights) happen once per paid order.
CREATE TABLE pro_periods (
    id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source text NOT NULL CHECK (source IN ('payment', 'admin')),
    payment_id text UNIQUE REFERENCES team_request_payments(id) ON DELETE CASCADE,
    days integer NOT NULL CHECK (days BETWEEN 1 AND 366),
    bonus_credits integer NOT NULL CHECK (bonus_credits BETWEEN 0 AND 3),
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at),
    CHECK ((source = 'payment') = (payment_id IS NOT NULL))
);
CREATE INDEX pro_periods_user ON pro_periods(user_id, created_at DESC);

-- +goose Down
DROP TABLE pro_periods;
DROP TABLE pro_memberships;
DELETE FROM team_request_payments WHERE product = 'pro';
ALTER TABLE team_request_payments
    DROP CONSTRAINT team_request_payments_product_credits,
    DROP COLUMN pro_plan_id,
    DROP COLUMN product,
    ADD CONSTRAINT team_request_payments_package_credits_check CHECK (package_credits IN (2, 5, 10));
DROP TABLE pro_plans;
DROP INDEX profile_views_profile_day;
ALTER TABLE profile_views DROP COLUMN private, DROP COLUMN last_viewed_at;
