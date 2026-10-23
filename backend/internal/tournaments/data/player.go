package data

import (
	"context"
	"database/sql"

	"futcareer/backend/internal/tournaments/domain"
)

var _ domain.PlayerTournaments = (*Postgres)(nil)

// PlayerTournaments lists the running and finished tournaments whose
// accepted roster includes the player, running first.
func (r *Postgres) PlayerTournaments(ctx context.Context, playerID string) ([]domain.PlayerTournament, error) {
	return r.teamTournaments(ctx, `JOIN tournament_entry_players p ON p.entry_id=e.id AND p.player_id=$1`, ``, playerID)
}

// ClubTournaments lists the club's own accepted entries the same way.
func (r *Postgres) ClubTournaments(ctx context.Context, clubID string) ([]domain.PlayerTournament, error) {
	return r.teamTournaments(ctx, ``, ` AND e.club_user_id=$1`, clubID)
}

func (r *Postgres) teamTournaments(ctx context.Context, join, where, id string) ([]domain.PlayerTournament, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	rows, err := tx.QueryContext(ctx, `SELECT e.id,e.tournament_id,e.club_user_id,u.full_name
		FROM tournament_entries e `+join+`
		JOIN tournaments t ON t.id=e.tournament_id JOIN users o ON o.id=t.organizer_id AND o.active
		JOIN users u ON u.id=e.club_user_id
		WHERE e.status='accepted' AND t.status IN ('open','closed','finished')`+where+`
		ORDER BY CASE t.status WHEN 'closed' THEN 0 WHEN 'open' THEN 1 ELSE 2 END,t.starts_on DESC,t.id LIMIT 20`, id)
	if err != nil {
		return nil, err
	}
	out := []domain.PlayerTournament{}
	for rows.Next() {
		var item domain.PlayerTournament
		if err = rows.Scan(&item.EntryID, &item.Tournament.ID, &item.ClubID, &item.ClubName); err != nil {
			rows.Close()
			return nil, err
		}
		out = append(out, item)
	}
	if err = closeRows(rows); err != nil {
		return nil, err
	}
	for i := range out {
		t, err := table(ctx, tx, "", out[i].Tournament.ID)
		if err != nil {
			return nil, err
		}
		out[i].Tournament = t.Tournament
		out[i].Teams = len(t.Teams)
		for _, s := range t.Standings {
			if s.EntryID == out[i].EntryID {
				out[i].Position, out[i].Points = s.Position, s.Points
			}
		}
		// Matches come ordered by round and kickoff; the first unplayed one
		// of this team is next.
		for _, m := range t.Matches {
			if m.HomeGoals == nil && (m.HomeEntryID == out[i].EntryID || m.AwayEntryID == out[i].EntryID) {
				match := m
				out[i].NextMatch = &match
				break
			}
		}
	}
	return out, tx.Commit()
}
