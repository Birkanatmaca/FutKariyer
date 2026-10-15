-- +goose Up
-- App Store and Google Play in-app purchases. The store charges its own price;
-- the administrator maps each package and the Pro plan to a store product id
-- and keeps amount_minor as the reporting value. Store orders reuse the order,
-- event and Pro period tables: provider is app_store or google_play and
-- provider_payment_id is the store transaction id (Apple) or order id (Google).
ALTER TABLE team_request_packages
    ADD COLUMN apple_product_id text UNIQUE CHECK (apple_product_id ~ '^[A-Za-z0-9._]{1,100}$'),
    ADD COLUMN google_product_id text UNIQUE CHECK (google_product_id ~ '^[a-z0-9][a-z0-9._]{0,99}$');
UPDATE team_request_packages
SET apple_product_id = 'com.futcareer.rights.' || credits,
    google_product_id = 'com.futcareer.rights.' || credits;

ALTER TABLE pro_plans
    ADD COLUMN apple_product_id text UNIQUE CHECK (apple_product_id ~ '^[A-Za-z0-9._]{1,100}$'),
    ADD COLUMN google_product_id text UNIQUE CHECK (google_product_id ~ '^[a-z0-9][a-z0-9._]{0,99}$');
UPDATE pro_plans
SET apple_product_id = 'com.futcareer.pro.30days',
    google_product_id = 'com.futcareer.pro.30days';

-- Google refunds are polled from the voided purchases list; the cursor survives restarts.
CREATE TABLE store_sync_cursors (
    name text PRIMARY KEY CHECK (char_length(name) BETWEEN 1 AND 80),
    position timestamptz NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE store_sync_cursors;
ALTER TABLE pro_plans DROP COLUMN apple_product_id, DROP COLUMN google_product_id;
ALTER TABLE team_request_packages DROP COLUMN apple_product_id, DROP COLUMN google_product_id;
