-- +goose Up
-- İzleme listesi (20 Oct 2026): a coach stars players while scouting. Only
-- players still visible in discovery are listed; a hidden player's row stays,
-- so the star comes back if the player shows up again.
CREATE TABLE player_watchlist (
    owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, player_id),
    CHECK (owner_id <> player_id)
);
CREATE INDEX player_watchlist_recent ON player_watchlist(owner_id, created_at DESC);

-- +goose Down
DROP TABLE player_watchlist;
