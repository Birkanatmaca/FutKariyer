-- +goose Up
CREATE TABLE leagues (
    id text PRIMARY KEY,
    name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
    season text NOT NULL CHECK (char_length(season) BETWEEN 1 AND 40),
    description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','finished')),
    win_points integer NOT NULL DEFAULT 3 CHECK (win_points BETWEEN 0 AND 10),
    draw_points integer NOT NULL DEFAULT 1 CHECK (draw_points BETWEEN 0 AND 10),
    loss_points integer NOT NULL DEFAULT 0 CHECK (loss_points BETWEEN 0 AND 10),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX leagues_public_order ON leagues(created_at DESC,id DESC) WHERE status IN ('active','finished');

CREATE TABLE league_teams (
    id text PRIMARY KEY,
    league_id text NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    club_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (league_id,club_user_id),
    UNIQUE (id,league_id)
);

CREATE TABLE league_matches (
    id text PRIMARY KEY,
    league_id text NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    round integer NOT NULL CHECK (round BETWEEN 1 AND 100),
    home_team_id text NOT NULL,
    away_team_id text NOT NULL,
    kickoff_at timestamptz,
    home_goals integer,
    away_goals integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (home_team_id <> away_team_id),
    CHECK ((home_goals IS NULL AND away_goals IS NULL) OR
           (home_goals BETWEEN 0 AND 50 AND away_goals BETWEEN 0 AND 50)),
    FOREIGN KEY (home_team_id,league_id) REFERENCES league_teams(id,league_id) ON DELETE CASCADE,
    FOREIGN KEY (away_team_id,league_id) REFERENCES league_teams(id,league_id) ON DELETE CASCADE
);

CREATE INDEX league_matches_schedule ON league_matches(league_id,round,kickoff_at,id);

-- +goose Down
DROP TABLE league_matches;
DROP TABLE league_teams;
DROP INDEX leagues_public_order;
DROP TABLE leagues;
