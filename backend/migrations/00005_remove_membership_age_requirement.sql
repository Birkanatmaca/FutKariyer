-- +goose Up
-- Keep previous declarations as historical data; new accounts collect no age declaration.
ALTER TABLE users DROP CONSTRAINT users_adult_confirmed_check;
ALTER TABLE users ALTER COLUMN adult_confirmed DROP NOT NULL;

-- +goose Down
-- Never invent an adult declaration for accounts created without one.
-- +goose StatementBegin
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM users WHERE adult_confirmed IS DISTINCT FROM TRUE) THEN
  RAISE EXCEPTION 'Accounts without an age declaration exist; the previous membership requirement cannot be restored';
 END IF;
END $$;
-- +goose StatementEnd
ALTER TABLE users ALTER COLUMN adult_confirmed SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_adult_confirmed_check CHECK (adult_confirmed);
