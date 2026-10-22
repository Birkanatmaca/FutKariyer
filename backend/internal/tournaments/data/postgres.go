package data

import (
	"context"
	"database/sql"
	"errors"
	"slices"
	"strings"
	"time"

	notificationsdata "futcareer/backend/internal/notifications/data"
	notificationsdomain "futcareer/backend/internal/notifications/domain"
	"futcareer/backend/internal/tournaments/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

// today is evaluated in Türkiye time, matching the calendar dates organizers enter.
const today = `(clock_timestamp() AT TIME ZONE 'Europe/Istanbul')::date`

const columns = `t.id,t.organizer_id,o.full_name,t.name,t.format,array_to_string(t.eligible_types,','),t.district,t.venue,t.description,
	to_char(t.starts_on,'YYYY-MM-DD'),to_char(t.ends_on,'YYYY-MM-DD'),to_char(t.application_deadline,'YYYY-MM-DD'),t.team_capacity,t.status,
	(SELECT count(*) FROM tournament_entries e WHERE e.tournament_id=t.id AND e.status='accepted'),
	(SELECT count(*) FROM tournament_entries e WHERE e.tournament_id=t.id AND e.status='pending'),
	t.created_at`
const joins = ` FROM tournaments t JOIN users o ON o.id=t.organizer_id`

type scanner interface{ Scan(...any) error }

func scan(row scanner) (domain.Tournament, error) {
	var t domain.Tournament
	var types string
	err := row.Scan(&t.ID, &t.OrganizerID, &t.OrganizerName, &t.Name, &t.Format, &types, &t.District, &t.Venue, &t.Description,
		&t.StartsOn, &t.EndsOn, &t.ApplicationDeadline, &t.TeamCapacity, &t.Status, &t.AcceptedTeams, &t.PendingEntries, &t.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return t, domain.ErrNotFound
	}
	if err != nil {
		return t, err
	}
	t.EligibleTypes = strings.Split(types, ",")
	t.CreatedAt = t.CreatedAt.UTC()
	return t, nil
}

func list(rows *sql.Rows, err error) ([]domain.Tournament, error) {
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Tournament{}
	for rows.Next() {
		t, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// Create publishes a tournament for a verified organizer and notifies active
// clubs whose team type is eligible, in the same transaction.
func (r *Postgres) Create(ctx context.Context, t domain.Tournament) (domain.Tournament, int, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return t, 0, err
	}
	defer tx.Rollback()
	var verified bool
	var organizer string
	err = tx.QueryRowContext(ctx, `SELECT verified,full_name FROM users WHERE id=$1 AND role='organizer' AND active FOR UPDATE`, t.OrganizerID).Scan(&verified, &organizer)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !verified) {
		return t, 0, domain.ErrForbidden
	}
	if err != nil {
		return t, 0, err
	}
	types := strings.Join(t.EligibleTypes, ",")
	if _, err = tx.ExecContext(ctx, `INSERT INTO tournaments(id,organizer_id,name,format,eligible_types,district,venue,description,starts_on,ends_on,application_deadline,team_capacity)
		VALUES($1,$2,$3,$4,string_to_array($5,','),$6,$7,$8,$9::date,$10::date,$11::date,$12)`,
		t.ID, t.OrganizerID, t.Name, t.Format, types, t.District, t.Venue, t.Description, t.StartsOn, t.EndsOn, t.ApplicationDeadline, t.TeamCapacity); err != nil {
		return t, 0, err
	}
	res, err := tx.ExecContext(ctx, `INSERT INTO notifications(id,recipient_id,kind,title,body,resource_id,source_key)
		SELECT md5(random()::text || clock_timestamp()::text || u.id), u.id, 'tournament', $2, $3, $1, 'tournament:' || $1 || ':open'
		FROM users u JOIN clubs c ON c.user_id=u.id
		WHERE u.active AND u.role='club' AND c.football_type = ANY(string_to_array($4,','))`,
		t.ID, t.Name, organizer+" yeni bir turnuva açtı. Son başvuru günü: "+t.ApplicationDeadline+".", types)
	if err != nil {
		return t, 0, err
	}
	notified, err := res.RowsAffected()
	if err != nil {
		return t, 0, err
	}
	out, err := scan(tx.QueryRowContext(ctx, `SELECT `+columns+joins+` WHERE t.id=$1`, t.ID))
	if err != nil {
		return out, 0, err
	}
	return out, int(notified), tx.Commit()
}

func (r *Postgres) Mine(ctx context.Context, organizerID string) ([]domain.Tournament, error) {
	return list(r.db.QueryContext(ctx, `SELECT `+columns+joins+` WHERE t.organizer_id=$1 ORDER BY t.starts_on DESC,t.id DESC LIMIT 200`, organizerID))
}

var transitions = map[string][]string{
	"open":   {"closed", "cancelled"},
	"closed": {"open", "finished", "cancelled"},
}

// SetStatus moves a tournament through open -> closed -> finished, with
// cancellation from open or closed. Cancelling notifies every active entry.
func (r *Postgres) SetStatus(ctx context.Context, organizerID, id, status string) (domain.Tournament, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Tournament{}, err
	}
	defer tx.Rollback()
	var current, name string
	var deadlinePassed bool
	err = tx.QueryRowContext(ctx, `SELECT status,name,application_deadline < `+today+` FROM tournaments WHERE id=$1 AND organizer_id=$2 FOR UPDATE`, id, organizerID).Scan(&current, &name, &deadlinePassed)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Tournament{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Tournament{}, err
	}
	if current != status {
		if !slices.Contains(transitions[current], status) || (status == "open" && deadlinePassed) {
			return domain.Tournament{}, domain.ErrInvalidState
		}
		if _, err = tx.ExecContext(ctx, `UPDATE tournaments SET status=$2 WHERE id=$1`, id, status); err != nil {
			return domain.Tournament{}, err
		}
		if status == "cancelled" {
			if _, err = tx.ExecContext(ctx, `INSERT INTO notifications(id,recipient_id,kind,title,body,resource_id,source_key)
				SELECT md5(random()::text || clock_timestamp()::text || e.id), e.club_user_id, 'tournament', 'Turnuva iptal edildi', $2 || ' turnuvası organizatör tarafından iptal edildi.', e.id, 'tournament-entry:' || e.id || ':cancelled'
				FROM tournament_entries e JOIN users u ON u.id=e.club_user_id AND u.active
				WHERE e.tournament_id=$1 AND e.status IN ('pending','accepted')`, id, name); err != nil {
				return domain.Tournament{}, err
			}
		}
	}
	out, err := scan(tx.QueryRowContext(ctx, `SELECT `+columns+joins+` WHERE t.id=$1`, id))
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

const entryColumns = `e.id,e.tournament_id,t.name,t.status,e.club_user_id,u.full_name,c.district,c.football_type,e.message,e.status,e.created_at,e.decided_at`
const entryJoins = ` FROM tournament_entries e JOIN tournaments t ON t.id=e.tournament_id JOIN users u ON u.id=e.club_user_id JOIN clubs c ON c.user_id=u.id`

func scanEntry(row scanner) (domain.Entry, error) {
	var e domain.Entry
	var decided sql.NullTime
	err := row.Scan(&e.ID, &e.TournamentID, &e.TournamentName, &e.TournamentStatus, &e.ClubID, &e.ClubName, &e.ClubDistrict, &e.ClubFootballType, &e.Message, &e.Status, &e.CreatedAt, &decided)
	if errors.Is(err, sql.ErrNoRows) {
		return e, domain.ErrNotFound
	}
	if err != nil {
		return e, err
	}
	e.CreatedAt = e.CreatedAt.UTC()
	if decided.Valid {
		at := decided.Time.UTC()
		e.DecidedAt = &at
	}
	e.Players = []domain.EntryPlayer{}
	return e, nil
}

type querier interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

// withPlayers loads rosters for the given entries in one query.
func withPlayers(ctx context.Context, q querier, entries []domain.Entry) ([]domain.Entry, error) {
	if len(entries) == 0 {
		return entries, nil
	}
	ids := make([]string, len(entries))
	index := map[string]int{}
	for i, e := range entries {
		ids[i] = e.ID
		index[e.ID] = i
	}
	rows, err := q.QueryContext(ctx, `SELECT p.entry_id,u.id,u.full_name,COALESCE(pp.position,'') FROM tournament_entry_players p
		JOIN users u ON u.id=p.player_id LEFT JOIN player_profiles pp ON pp.user_id=u.id
		WHERE p.entry_id = ANY(string_to_array($1,',')) ORDER BY lower(u.full_name),u.id`, strings.Join(ids, ","))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var entryID string
		var p domain.EntryPlayer
		if err := rows.Scan(&entryID, &p.ID, &p.Name, &p.Position); err != nil {
			return nil, err
		}
		i := index[entryID]
		entries[i].Players = append(entries[i].Players, p)
	}
	return entries, rows.Err()
}

func entries(ctx context.Context, q querier, query string, args ...any) ([]domain.Entry, error) {
	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	out := []domain.Entry{}
	for rows.Next() {
		e, err := scanEntry(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		out = append(out, e)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()
	return withPlayers(ctx, q, out)
}

func oneEntry(ctx context.Context, q querier, id string) (domain.Entry, error) {
	list, err := entries(ctx, q, `SELECT `+entryColumns+entryJoins+` WHERE e.id=$1`, id)
	if err != nil {
		return domain.Entry{}, err
	}
	if len(list) == 0 {
		return domain.Entry{}, domain.ErrNotFound
	}
	return list[0], nil
}

func (r *Postgres) Entries(ctx context.Context, organizerID, tournamentID string) ([]domain.Entry, error) {
	var exists bool
	if err := r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM tournaments WHERE id=$1 AND organizer_id=$2)`, tournamentID, organizerID).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, domain.ErrNotFound
	}
	return entries(ctx, r.db, `SELECT `+entryColumns+entryJoins+` WHERE e.tournament_id=$1 AND e.status<>'withdrawn' ORDER BY e.status='pending' DESC,e.created_at,e.id`, tournamentID)
}

// Decide accepts or rejects a pending entry. Acceptance respects the team
// capacity; repeating a decision already taken is a no-op.
func (r *Postgres) Decide(ctx context.Context, organizerID, tournamentID, entryID string, accept bool) (domain.Entry, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Entry{}, err
	}
	defer tx.Rollback()
	var name, tStatus string
	var capacity int
	err = tx.QueryRowContext(ctx, `SELECT name,status,team_capacity FROM tournaments WHERE id=$1 AND organizer_id=$2 FOR UPDATE`, tournamentID, organizerID).Scan(&name, &tStatus, &capacity)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Entry{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Entry{}, err
	}
	var clubID, status string
	err = tx.QueryRowContext(ctx, `SELECT club_user_id,status FROM tournament_entries WHERE id=$1 AND tournament_id=$2 FOR UPDATE`, entryID, tournamentID).Scan(&clubID, &status)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Entry{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Entry{}, err
	}
	target := "rejected"
	if accept {
		target = "accepted"
	}
	if status != target {
		if status != "pending" || tStatus == "finished" || tStatus == "cancelled" {
			return domain.Entry{}, domain.ErrInvalidState
		}
		if accept {
			var accepted int
			if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM tournament_entries WHERE tournament_id=$1 AND status='accepted'`, tournamentID).Scan(&accepted); err != nil {
				return domain.Entry{}, err
			}
			if accepted >= capacity {
				return domain.Entry{}, domain.ErrFull
			}
		}
		if _, err = tx.ExecContext(ctx, `UPDATE tournament_entries SET status=$2,decided_at=$3 WHERE id=$1`, entryID, target, time.Now().UTC()); err != nil {
			return domain.Entry{}, err
		}
		if err = notificationsdata.CreateInTx(ctx, tx, notificationsdomain.NewTournamentDecision(clubID, entryID, name, accept)); err != nil {
			return domain.Entry{}, err
		}
	}
	out, err := oneEntry(ctx, tx, entryID)
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

// List pages the public tournaments. By default only those still taking
// entries, soonest first; with filter.All also running and finished ones,
// running first.
func (r *Postgres) List(ctx context.Context, filter domain.Filter, page int) (domain.Page, error) {
	const size = 20
	out := domain.Page{Items: []domain.Tournament{}, Page: page, PageSize: size}
	where := ` WHERE t.status='open' AND o.active AND t.application_deadline >= ` + today
	order := ` ORDER BY t.starts_on,t.id`
	if filter.All {
		where = ` WHERE t.status IN ('open','closed','finished') AND o.active`
		order = ` ORDER BY CASE t.status WHEN 'closed' THEN 0 WHEN 'open' THEN 1 ELSE 2 END,t.starts_on DESC,t.id`
	}
	args := []any{size, (page - 1) * size}
	if filter.Format != "" {
		where += ` AND t.format=$3`
		args = append(args, filter.Format)
	}
	countArgs := []any{}
	countWhere := where
	if filter.Format != "" {
		countWhere = strings.Replace(where, "$3", "$1", 1)
		countArgs = append(countArgs, filter.Format)
	}
	if err := r.db.QueryRowContext(ctx, `SELECT count(*)`+joins+countWhere, countArgs...).Scan(&out.Total); err != nil {
		return out, err
	}
	items, err := list(r.db.QueryContext(ctx, `SELECT `+columns+joins+where+order+` LIMIT $1 OFFSET $2`, args...))
	if err != nil {
		return out, err
	}
	out.Items = items
	out.TotalPages = (out.Total + size - 1) / size
	return out, nil
}

// Get returns any non-cancelled tournament of an active organizer.
func (r *Postgres) Get(ctx context.Context, id string) (domain.Tournament, error) {
	return scan(r.db.QueryRowContext(ctx, `SELECT `+columns+joins+` WHERE t.id=$1 AND o.active AND t.status<>'cancelled'`, id))
}

// Enter registers a club for a tournament with a roster from its squad. A club
// that withdrew or declined an invitation may enter again; a rejected club may not.
func (r *Postgres) Enter(ctx context.Context, clubID, tournamentID, entryID, message string, playerIDs []string) (domain.Entry, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Entry{}, err
	}
	defer tx.Rollback()
	var footballType, clubName string
	err = tx.QueryRowContext(ctx, `SELECT c.football_type,u.full_name FROM users u JOIN clubs c ON c.user_id=u.id WHERE u.id=$1 AND u.active AND u.role='club' FOR UPDATE OF u`, clubID).Scan(&footballType, &clubName)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Entry{}, domain.ErrForbidden
	}
	if err != nil {
		return domain.Entry{}, err
	}
	var organizerID, name, status, types string
	var deadlinePassed bool
	err = tx.QueryRowContext(ctx, `SELECT t.organizer_id,t.name,t.status,array_to_string(t.eligible_types,','),t.application_deadline < `+today+`
		FROM tournaments t JOIN users o ON o.id=t.organizer_id AND o.active WHERE t.id=$1 FOR SHARE OF t`, tournamentID).Scan(&organizerID, &name, &status, &types, &deadlinePassed)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Entry{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Entry{}, err
	}
	if status != "open" || deadlinePassed {
		return domain.Entry{}, domain.ErrClosed
	}
	if !slices.Contains(strings.Split(types, ","), footballType) {
		return domain.Entry{}, domain.ErrNotEligible
	}
	if len(playerIDs) > 0 {
		var members int
		if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM club_squad_members m JOIN users u ON u.id=m.player_id AND u.active
			WHERE m.club_user_id=$1 AND m.left_at IS NULL AND m.player_id = ANY(string_to_array($2,','))`, clubID, strings.Join(playerIDs, ",")).Scan(&members); err != nil {
			return domain.Entry{}, err
		}
		if members != len(playerIDs) {
			return domain.Entry{}, domain.ErrNotInSquad
		}
	}
	var existingID, existingStatus string
	err = tx.QueryRowContext(ctx, `SELECT id,status FROM tournament_entries WHERE tournament_id=$1 AND club_user_id=$2 FOR UPDATE`, tournamentID, clubID).Scan(&existingID, &existingStatus)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		if _, err = tx.ExecContext(ctx, `INSERT INTO tournament_entries(id,tournament_id,club_user_id,message) VALUES($1,$2,$3,$4)`, entryID, tournamentID, clubID, message); err != nil {
			return domain.Entry{}, err
		}
	case err != nil:
		return domain.Entry{}, err
	case existingStatus != "withdrawn" && existingStatus != "declined":
		return domain.Entry{}, domain.ErrDuplicate
	default:
		entryID = existingID
		if _, err = tx.ExecContext(ctx, `UPDATE tournament_entries SET status='pending',message=$2,decided_at=NULL,created_at=clock_timestamp() WHERE id=$1`, entryID, message); err != nil {
			return domain.Entry{}, err
		}
		if _, err = tx.ExecContext(ctx, `DELETE FROM tournament_entry_players WHERE entry_id=$1`, entryID); err != nil {
			return domain.Entry{}, err
		}
	}
	for _, playerID := range playerIDs {
		if _, err = tx.ExecContext(ctx, `INSERT INTO tournament_entry_players(entry_id,player_id) VALUES($1,$2)`, entryID, playerID); err != nil {
			return domain.Entry{}, err
		}
	}
	if err = notificationsdata.CreateInTx(ctx, tx, notificationsdomain.NewTournamentEntry(organizerID, entryID, clubID, name)); err != nil {
		return domain.Entry{}, err
	}
	out, err := oneEntry(ctx, tx, entryID)
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

func (r *Postgres) ClubEntries(ctx context.Context, clubID string) ([]domain.Entry, error) {
	return entries(ctx, r.db, `SELECT `+entryColumns+entryJoins+` WHERE e.club_user_id=$1 ORDER BY e.created_at DESC,e.id DESC LIMIT 100`, clubID)
}

// Withdraw takes a pending or accepted entry back while the tournament is still running registration or play.
func (r *Postgres) Withdraw(ctx context.Context, clubID, entryID string) (domain.Entry, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Entry{}, err
	}
	defer tx.Rollback()
	var status, tStatus string
	err = tx.QueryRowContext(ctx, `SELECT e.status,t.status FROM tournament_entries e JOIN tournaments t ON t.id=e.tournament_id WHERE e.id=$1 AND e.club_user_id=$2 FOR UPDATE OF e`, entryID, clubID).Scan(&status, &tStatus)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Entry{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Entry{}, err
	}
	if status != "withdrawn" {
		if (status != "pending" && status != "accepted") || tStatus == "finished" || tStatus == "cancelled" {
			return domain.Entry{}, domain.ErrInvalidState
		}
		if _, err = tx.ExecContext(ctx, `UPDATE tournament_entries SET status='withdrawn',decided_at=clock_timestamp() WHERE id=$1`, entryID); err != nil {
			return domain.Entry{}, err
		}
	}
	out, err := oneEntry(ctx, tx, entryID)
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}
