-- +goose Up
-- Account profile (19 Oct 2026): personal details every account can edit and
-- a profile photo shown to everyone. avatar_version is 0 without a photo and
-- grows with each upload, so clients can cache /v1/users/{id}/avatar?v=N.
ALTER TABLE users
  ADD COLUMN district text NOT NULL DEFAULT '' CHECK (char_length(district) <= 60),
  ADD COLUMN birth_date date CHECK (birth_date IS NULL OR birth_date BETWEEN DATE '1930-01-01' AND DATE '2020-12-31'),
  ADD COLUMN bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 300),
  ADD COLUMN height_cm smallint CHECK (height_cm IS NULL OR height_cm BETWEEN 120 AND 230),
  ADD COLUMN weight_kg smallint CHECK (weight_kg IS NULL OR weight_kg BETWEEN 35 AND 160),
  ADD COLUMN avatar_version integer NOT NULL DEFAULT 0 CHECK (avatar_version >= 0);

CREATE TABLE user_avatars (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mime text NOT NULL CHECK (mime IN ('image/jpeg', 'image/png')),
  size integer NOT NULL CHECK (size BETWEEN 1 AND 4194304),
  data bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (size = octet_length(data))
);

-- +goose Down
DROP TABLE user_avatars;
ALTER TABLE users
  DROP COLUMN avatar_version,
  DROP COLUMN weight_kg,
  DROP COLUMN height_cm,
  DROP COLUMN bio,
  DROP COLUMN birth_date,
  DROP COLUMN district;
