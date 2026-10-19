-- +goose Up
-- Coach accounts (19 Oct 2026). A coach declares football facts; clubs always
-- see them, the coach's public profile shows each group only when the coach
-- turns it on.
CREATE TABLE coach_profiles (
    user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    license_level text NOT NULL DEFAULT 'unknown'
        CHECK (license_level IN ('unknown','uefa_pro','uefa_a','uefa_b','uefa_c','grassroots','none')),
    specialties text[] NOT NULL DEFAULT '{}'
        CHECK (specialties <@ ARRAY['head_coach','assistant','goalkeeper','fitness','youth','analyst']::text[]),
    experience_years integer NOT NULL DEFAULT 0 CHECK (experience_years BETWEEN 0 AND 60),
    football_type text NOT NULL DEFAULT 'unknown'
        CHECK (football_type IN ('unknown','amateur','professional','halisaha')),
    availability text NOT NULL DEFAULT 'not_available'
        CHECK (availability IN ('seeking_team','open_to_offers','not_available')),
    past_clubs text[] NOT NULL DEFAULT '{}' CHECK (cardinality(past_clubs) <= 10),
    show_license boolean NOT NULL DEFAULT false,
    show_experience boolean NOT NULL DEFAULT false,
    show_football boolean NOT NULL DEFAULT false,
    show_clubs boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Club technical staff: only the club invites; the coach accepts. Declined,
-- cancelled, left and removed links are deleted. Permissions are the club
-- sections the coach may run after switching into the club account.
CREATE TABLE club_staff (
    club_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coach_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('invited','active')),
    role text NOT NULL DEFAULT 'head_coach'
        CHECK (role IN ('head_coach','assistant','goalkeeper','fitness','youth','analyst')),
    permissions text[] NOT NULL DEFAULT '{}'
        CHECK (permissions <@ ARRAY['applications','squad','listings','news','tournaments','profile','social']::text[]),
    invited_at timestamptz NOT NULL DEFAULT now(),
    joined_at timestamptz,
    PRIMARY KEY (club_user_id, coach_user_id),
    CHECK ((status = 'active') = (joined_at IS NOT NULL))
);
CREATE INDEX club_staff_coach_idx ON club_staff(coach_user_id);

-- A switched session belongs to the club; acting_user_id records the coach
-- who opened it and must still be an active staff member on every request.
ALTER TABLE sessions ADD COLUMN acting_user_id text REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE sessions ADD COLUMN acting_auth_version integer;
ALTER TABLE sessions ADD CONSTRAINT sessions_acting_check
    CHECK ((acting_user_id IS NULL) = (acting_auth_version IS NULL));
CREATE INDEX sessions_acting_idx ON sessions(acting_user_id) WHERE acting_user_id IS NOT NULL;

ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('team_application','payment','opportunity','gift','game_reward','news_review','connection','tournament','follow','staff'));

-- +goose Down
DELETE FROM notifications WHERE kind = 'staff';
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('team_application','payment','opportunity','gift','game_reward','news_review','connection','tournament','follow'));
DELETE FROM sessions WHERE acting_user_id IS NOT NULL;
DROP INDEX sessions_acting_idx;
ALTER TABLE sessions DROP CONSTRAINT sessions_acting_check;
ALTER TABLE sessions DROP COLUMN acting_auth_version;
ALTER TABLE sessions DROP COLUMN acting_user_id;
DROP TABLE club_staff;
DROP TABLE coach_profiles;
