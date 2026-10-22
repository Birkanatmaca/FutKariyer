package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	authdomain "futcareer/backend/internal/auth/domain"
	notificationsdata "futcareer/backend/internal/notifications/data"
	notificationsdomain "futcareer/backend/internal/notifications/domain"
	"futcareer/backend/internal/tournaments/domain"
)

// owned locks the organizer's tournament row and returns its name and status.
func owned(ctx context.Context, tx *sql.Tx, organizerID, tournamentID string) (name, status string, err error) {
	err = tx.QueryRowContext(ctx, `SELECT name,status FROM tournaments WHERE id=$1 AND organizer_id=$2 FOR UPDATE`, tournamentID, organizerID).Scan(&name, &status)
	if errors.Is(err, sql.ErrNoRows) {
		err = domain.ErrNotFound
	}
	return name, status, err
}

// playable is whether the fixture and scores can still change.
func playable(status string) bool { return status == "open" || status == "closed" }

const matchColumns = `m.id,m.round,m.home_entry_id,m.away_entry_id,hu.full_name,au.full_name,he.club_user_id,ae.club_user_id,m.kickoff_at,m.venue,m.home_goals,m.away_goals`
const matchJoins = ` FROM tournament_matches m
	JOIN tournament_entries he ON he.id=m.home_entry_id JOIN users hu ON hu.id=he.club_user_id
	JOIN tournament_entries ae ON ae.id=m.away_entry_id JOIN users au ON au.id=ae.club_user_id`

func scanMatch(row scanner) (domain.Match, error) {
	var m domain.Match
	var kickoff sql.NullTime
	var home, away sql.NullInt64
	err := row.Scan(&m.ID, &m.Round, &m.HomeEntryID, &m.AwayEntryID, &m.HomeName, &m.AwayName, &m.HomeClubID, &m.AwayClubID, &kickoff, &m.Venue, &home, &away)
	if errors.Is(err, sql.ErrNoRows) {
		return m, domain.ErrNotFound
	}
	if kickoff.Valid {
		at := kickoff.Time.UTC()
		m.KickoffAt = &at
	}
	if home.Valid && away.Valid {
		h, a := int(home.Int64), int(away.Int64)
		m.HomeGoals, m.AwayGoals = &h, &a
	}
	return m, err
}

// Table loads teams, fixture and standings. Only accepted teams count; a
// team that withdraws drops out of the table together with its results.
func (r *Postgres) Table(ctx context.Context, organizerID, tournamentID string) (domain.Table, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return domain.Table{}, err
	}
	defer tx.Rollback()
	out, err := table(ctx, tx, organizerID, tournamentID)
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

func table(ctx context.Context, tx *sql.Tx, organizerID, tournamentID string) (domain.Table, error) {
	out := domain.Table{Teams: []domain.Team{}, Matches: []domain.Match{}, Standings: []domain.Standing{}}
	var err error
	if organizerID == "" {
		out.Tournament, err = scan(tx.QueryRowContext(ctx, `SELECT `+columns+joins+` WHERE t.id=$1 AND o.active AND t.status<>'cancelled'`, tournamentID))
	} else {
		out.Tournament, err = scan(tx.QueryRowContext(ctx, `SELECT `+columns+joins+` WHERE t.id=$1 AND t.organizer_id=$2`, tournamentID, organizerID))
	}
	if err != nil {
		return out, err
	}
	rows, err := tx.QueryContext(ctx, `SELECT e.id,e.club_user_id,u.full_name,c.district,(SELECT count(*) FROM tournament_entry_players p WHERE p.entry_id=e.id)
		FROM tournament_entries e JOIN users u ON u.id=e.club_user_id JOIN clubs c ON c.user_id=u.id
		WHERE e.tournament_id=$1 AND e.status='accepted' ORDER BY lower(u.full_name),e.id`, tournamentID)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var t domain.Team
		if err = rows.Scan(&t.EntryID, &t.ClubID, &t.Name, &t.District, &t.Players); err != nil {
			rows.Close()
			return out, err
		}
		out.Teams = append(out.Teams, t)
	}
	if err = closeRows(rows); err != nil {
		return out, err
	}
	rows, err = tx.QueryContext(ctx, `SELECT `+matchColumns+matchJoins+` WHERE m.tournament_id=$1 ORDER BY m.round,m.kickoff_at NULLS LAST,m.created_at,m.id`, tournamentID)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		m, err := scanMatch(rows)
		if err != nil {
			rows.Close()
			return out, err
		}
		out.Matches = append(out.Matches, m)
	}
	if err = closeRows(rows); err != nil {
		return out, err
	}
	points := fmt.Sprintf(`(x.wins*%d+x.draws*%d+x.losses*%d)`, domain.WinPoints, domain.DrawPoints, domain.LossPoints)
	rows, err = tx.QueryContext(ctx, `WITH teams AS (
  SELECT e.id,e.club_user_id FROM tournament_entries e WHERE e.tournament_id=$1 AND e.status='accepted'
), played AS (
  SELECT m.home_entry_id AS team,m.home_goals AS gf,m.away_goals AS ga FROM tournament_matches m
    JOIN teams h ON h.id=m.home_entry_id JOIN teams a ON a.id=m.away_entry_id WHERE m.tournament_id=$1 AND m.home_goals IS NOT NULL
  UNION ALL
  SELECT m.away_entry_id,m.away_goals,m.home_goals FROM tournament_matches m
    JOIN teams h ON h.id=m.home_entry_id JOIN teams a ON a.id=m.away_entry_id WHERE m.tournament_id=$1 AND m.home_goals IS NOT NULL
), x AS (
  SELECT t.id,t.club_user_id,count(p.team)::int AS played,
    count(*) FILTER (WHERE p.gf>p.ga)::int AS wins,count(*) FILTER (WHERE p.gf=p.ga)::int AS draws,count(*) FILTER (WHERE p.gf<p.ga)::int AS losses,
    COALESCE(sum(p.gf),0)::int AS goals_for,COALESCE(sum(p.ga),0)::int AS goals_against
  FROM teams t LEFT JOIN played p ON p.team=t.id GROUP BY t.id,t.club_user_id
)
SELECT row_number() OVER (ORDER BY `+points+` DESC,(x.goals_for-x.goals_against) DESC,x.goals_for DESC,x.wins DESC,lower(u.full_name),x.id),
  x.id,x.club_user_id,u.full_name,x.played,x.wins,x.draws,x.losses,x.goals_for,x.goals_against,x.goals_for-x.goals_against,`+points+`
FROM x JOIN users u ON u.id=x.club_user_id
ORDER BY 1`, tournamentID)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var s domain.Standing
		if err = rows.Scan(&s.Position, &s.EntryID, &s.ClubID, &s.TeamName, &s.Played, &s.Wins, &s.Draws, &s.Losses, &s.GoalsFor, &s.GoalsAgainst, &s.GoalDiff, &s.Points); err != nil {
			rows.Close()
			return out, err
		}
		out.Standings = append(out.Standings, s)
	}
	return out, closeRows(rows)
}

func closeRows(rows *sql.Rows) error {
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	return rows.Close()
}

// GenerateFixture creates a round-robin fixture between the accepted teams.
// It refuses when the tournament already has matches, so a published
// fixture is never silently replaced.
func (r *Postgres) GenerateFixture(ctx context.Context, organizerID, tournamentID string, legs int, ids func() (string, error)) (domain.Table, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Table{}, err
	}
	defer tx.Rollback()
	name, status, err := owned(ctx, tx, organizerID, tournamentID)
	if err != nil {
		return domain.Table{}, err
	}
	if !playable(status) {
		return domain.Table{}, domain.ErrInvalidState
	}
	var existing int
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM tournament_matches WHERE tournament_id=$1`, tournamentID).Scan(&existing); err != nil {
		return domain.Table{}, err
	}
	if existing > 0 {
		return domain.Table{}, domain.ErrFixtureExists
	}
	rows, err := tx.QueryContext(ctx, `SELECT id,club_user_id FROM tournament_entries WHERE tournament_id=$1 AND status='accepted' ORDER BY decided_at,created_at,id`, tournamentID)
	if err != nil {
		return domain.Table{}, err
	}
	teams, clubs := []string{}, []string{}
	for rows.Next() {
		var id, club string
		if err = rows.Scan(&id, &club); err != nil {
			rows.Close()
			return domain.Table{}, err
		}
		teams, clubs = append(teams, id), append(clubs, club)
	}
	if err = closeRows(rows); err != nil {
		return domain.Table{}, err
	}
	if len(teams) < 2 {
		return domain.Table{}, domain.ErrTooFewTeams
	}
	for _, p := range domain.RoundRobin(teams, legs) {
		id, err := ids()
		if err != nil {
			return domain.Table{}, err
		}
		if _, err = tx.ExecContext(ctx, `INSERT INTO tournament_matches(id,tournament_id,round,home_entry_id,away_entry_id) VALUES($1,$2,$3,$4,$5)`, id, tournamentID, p.Round, p.Home, p.Away); err != nil {
			return domain.Table{}, err
		}
	}
	stamp := strconv.FormatInt(time.Now().UnixNano(), 10)
	for i, club := range clubs {
		if err = notificationsdata.CreateInTx(ctx, tx, notificationsdomain.NewNotification{
			RecipientID: club, Kind: notificationsdomain.KindTournament,
			Title: "Fikstür yayınlandı", Body: name + " turnuvasının fikstürü hazır. Maçlarını turnuva sayfasında gör.",
			ResourceID: teams[i], SourceKey: "tournament-entry:" + teams[i] + ":fixture:" + stamp,
		}); err != nil {
			return domain.Table{}, err
		}
	}
	out, err := table(ctx, tx, organizerID, tournamentID)
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

// ClearFixture removes matches that have no score yet; played matches stay.
func (r *Postgres) ClearFixture(ctx context.Context, organizerID, tournamentID string) (domain.Table, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Table{}, err
	}
	defer tx.Rollback()
	_, status, err := owned(ctx, tx, organizerID, tournamentID)
	if err != nil {
		return domain.Table{}, err
	}
	if !playable(status) {
		return domain.Table{}, domain.ErrInvalidState
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM tournament_matches WHERE tournament_id=$1 AND home_goals IS NULL`, tournamentID); err != nil {
		return domain.Table{}, err
	}
	out, err := table(ctx, tx, organizerID, tournamentID)
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

// SaveMatch adds a match or updates its round, time, venue, teams and score.
// Both teams must be accepted participants of the tournament.
func (r *Postgres) SaveMatch(ctx context.Context, organizerID, tournamentID string, m domain.Match, create bool) (domain.Match, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Match{}, err
	}
	defer tx.Rollback()
	_, status, err := owned(ctx, tx, organizerID, tournamentID)
	if err != nil {
		return domain.Match{}, err
	}
	if !playable(status) {
		return domain.Match{}, domain.ErrInvalidState
	}
	var teams int
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM tournament_entries WHERE tournament_id=$1 AND status='accepted' AND id IN ($2,$3)`, tournamentID, m.HomeEntryID, m.AwayEntryID).Scan(&teams); err != nil {
		return domain.Match{}, err
	}
	if teams != 2 {
		return domain.Match{}, domain.ErrNotTeam
	}
	var res sql.Result
	if create {
		res, err = tx.ExecContext(ctx, `INSERT INTO tournament_matches(id,tournament_id,round,home_entry_id,away_entry_id,kickoff_at,venue,home_goals,away_goals) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			m.ID, tournamentID, m.Round, m.HomeEntryID, m.AwayEntryID, m.KickoffAt, m.Venue, m.HomeGoals, m.AwayGoals)
	} else {
		res, err = tx.ExecContext(ctx, `UPDATE tournament_matches SET round=$3,home_entry_id=$4,away_entry_id=$5,kickoff_at=$6,venue=$7,home_goals=$8,away_goals=$9,updated_at=clock_timestamp() WHERE id=$1 AND tournament_id=$2`,
			m.ID, tournamentID, m.Round, m.HomeEntryID, m.AwayEntryID, m.KickoffAt, m.Venue, m.HomeGoals, m.AwayGoals)
	}
	if err != nil {
		return domain.Match{}, err
	}
	if n, err := res.RowsAffected(); err != nil {
		return domain.Match{}, err
	} else if n == 0 {
		return domain.Match{}, domain.ErrNotFound
	}
	out, err := scanMatch(tx.QueryRowContext(ctx, `SELECT `+matchColumns+matchJoins+` WHERE m.id=$1`, m.ID))
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

func (r *Postgres) DeleteMatch(ctx context.Context, organizerID, tournamentID, matchID string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, status, err := owned(ctx, tx, organizerID, tournamentID)
	if err != nil {
		return err
	}
	if !playable(status) {
		return domain.ErrInvalidState
	}
	res, err := tx.ExecContext(ctx, `DELETE FROM tournament_matches WHERE id=$1 AND tournament_id=$2`, matchID, tournamentID)
	if err != nil {
		return err
	}
	if n, err := res.RowsAffected(); err != nil {
		return err
	} else if n == 0 {
		return domain.ErrNotFound
	}
	return tx.Commit()
}

// Candidates lists active clubs of an eligible type that have no live entry
// in the tournament, by name.
func (r *Postgres) Candidates(ctx context.Context, organizerID, tournamentID, search string) ([]domain.Candidate, error) {
	var types string
	err := r.db.QueryRowContext(ctx, `SELECT array_to_string(eligible_types,',') FROM tournaments WHERE id=$1 AND organizer_id=$2`, tournamentID, organizerID).Scan(&types)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT u.id,u.full_name,c.district,c.football_type FROM users u JOIN clubs c ON c.user_id=u.id
		WHERE u.active AND u.role='club' AND c.football_type = ANY(string_to_array($2,','))
		  AND strpos(lower(u.full_name),lower($3)) > 0
		  AND NOT EXISTS (SELECT 1 FROM tournament_entries e WHERE e.tournament_id=$1 AND e.club_user_id=u.id AND e.status IN ('pending','accepted','invited','rejected'))
		ORDER BY lower(u.full_name),u.id LIMIT 20`, tournamentID, types, search)
	if err != nil {
		return nil, err
	}
	out := []domain.Candidate{}
	for rows.Next() {
		var c domain.Candidate
		if err = rows.Scan(&c.ID, &c.Name, &c.District, &c.FootballType); err != nil {
			rows.Close()
			return nil, err
		}
		out = append(out, c)
	}
	return out, closeRows(rows)
}

// Invite asks a club to join. A club with no entry, or one that withdrew or
// declined before, can be invited; acceptance happens in RespondInvite.
func (r *Postgres) Invite(ctx context.Context, organizerID, tournamentID, entryID, clubID, message string) (domain.Entry, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Entry{}, err
	}
	defer tx.Rollback()
	name, status, err := owned(ctx, tx, organizerID, tournamentID)
	if err != nil {
		return domain.Entry{}, err
	}
	if !playable(status) {
		return domain.Entry{}, domain.ErrInvalidState
	}
	var eligible bool
	err = tx.QueryRowContext(ctx, `SELECT c.football_type = ANY(t.eligible_types) FROM users u JOIN clubs c ON c.user_id=u.id, tournaments t
		WHERE u.id=$1 AND u.active AND u.role='club' AND t.id=$2`, clubID, tournamentID).Scan(&eligible)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Entry{}, domain.ErrNotInvitable
	}
	if err != nil {
		return domain.Entry{}, err
	}
	if !eligible {
		return domain.Entry{}, domain.ErrNotEligible
	}
	var existingID, existing string
	err = tx.QueryRowContext(ctx, `SELECT id,status FROM tournament_entries WHERE tournament_id=$1 AND club_user_id=$2 FOR UPDATE`, tournamentID, clubID).Scan(&existingID, &existing)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		if _, err = tx.ExecContext(ctx, `INSERT INTO tournament_entries(id,tournament_id,club_user_id,message,status) VALUES($1,$2,$3,$4,'invited')`, entryID, tournamentID, clubID, message); err != nil {
			return domain.Entry{}, err
		}
	case err != nil:
		return domain.Entry{}, err
	case existing != "withdrawn" && existing != "declined":
		return domain.Entry{}, domain.ErrNotInvitable
	default:
		entryID = existingID
		if _, err = tx.ExecContext(ctx, `UPDATE tournament_entries SET status='invited',message=$2,decided_at=NULL,created_at=clock_timestamp() WHERE id=$1`, entryID, message); err != nil {
			return domain.Entry{}, err
		}
		if _, err = tx.ExecContext(ctx, `DELETE FROM tournament_entry_players WHERE entry_id=$1`, entryID); err != nil {
			return domain.Entry{}, err
		}
	}
	if err = notificationsdata.CreateInTx(ctx, tx, notificationsdomain.NewNotification{
		RecipientID: clubID, Kind: notificationsdomain.KindTournament, ActorID: organizerID,
		Title: "Turnuva daveti", Body: notificationsdomain.Actor + " takımını " + name + " turnuvasına davet etti.",
		ResourceID: entryID, SourceKey: "tournament-entry:" + entryID + ":invite:" + strconv.FormatInt(time.Now().UnixNano(), 10),
	}); err != nil {
		return domain.Entry{}, err
	}
	out, err := oneEntry(ctx, tx, entryID)
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

// CancelInvite takes back an invitation the club has not answered.
func (r *Postgres) CancelInvite(ctx context.Context, organizerID, tournamentID, entryID string) (domain.Entry, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Entry{}, err
	}
	defer tx.Rollback()
	if _, _, err = owned(ctx, tx, organizerID, tournamentID); err != nil {
		return domain.Entry{}, err
	}
	var status string
	err = tx.QueryRowContext(ctx, `SELECT status FROM tournament_entries WHERE id=$1 AND tournament_id=$2 FOR UPDATE`, entryID, tournamentID).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Entry{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Entry{}, err
	}
	if status != "withdrawn" {
		if status != "invited" {
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

// RespondInvite lets the club accept with a roster from its squad, within the
// team capacity, or decline. The organizer is notified either way.
func (r *Postgres) RespondInvite(ctx context.Context, clubID, entryID string, accept bool, playerIDs []string) (domain.Entry, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Entry{}, err
	}
	defer tx.Rollback()
	var tournamentID, organizerID, name, tStatus, status string
	var capacity int
	err = tx.QueryRowContext(ctx, `SELECT t.id,t.organizer_id,t.name,t.status,t.team_capacity,e.status FROM tournament_entries e JOIN tournaments t ON t.id=e.tournament_id
		WHERE e.id=$1 AND e.club_user_id=$2 FOR UPDATE OF t,e`, entryID, clubID).Scan(&tournamentID, &organizerID, &name, &tStatus, &capacity, &status)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Entry{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Entry{}, err
	}
	if status != "invited" || !playable(tStatus) {
		return domain.Entry{}, domain.ErrInvalidState
	}
	target := "declined"
	if accept {
		target = "accepted"
		var accepted int
		if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM tournament_entries WHERE tournament_id=$1 AND status='accepted'`, tournamentID).Scan(&accepted); err != nil {
			return domain.Entry{}, err
		}
		if accepted >= capacity {
			return domain.Entry{}, domain.ErrFull
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
		for _, playerID := range playerIDs {
			if _, err = tx.ExecContext(ctx, `INSERT INTO tournament_entry_players(entry_id,player_id) VALUES($1,$2)`, entryID, playerID); err != nil {
				return domain.Entry{}, err
			}
		}
	}
	if _, err = tx.ExecContext(ctx, `UPDATE tournament_entries SET status=$2,decided_at=clock_timestamp() WHERE id=$1`, entryID, target); err != nil {
		return domain.Entry{}, err
	}
	n := notificationsdomain.NewNotification{
		RecipientID: organizerID, Kind: notificationsdomain.KindTournament, ActorID: clubID,
		Title: "Davet reddedildi", Body: notificationsdomain.Actor + ", " + name + " davetini kabul etmedi.",
		ResourceID: entryID, SourceKey: "tournament-entry:" + entryID + ":invite-answer:" + strconv.FormatInt(time.Now().UnixNano(), 10),
	}
	if accept {
		n.Title, n.Body = "Davet kabul edildi", notificationsdomain.Actor+", "+name+" turnuvasına katıldı."
	}
	if err = notificationsdata.CreateInTx(ctx, tx, n); err != nil {
		return domain.Entry{}, err
	}
	out, err := oneEntry(ctx, tx, entryID)
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

// Organizers pages organizer accounts for administrators, newest first.
func (r *Postgres) Organizers(ctx context.Context, page int) (domain.OrganizerPage, error) {
	const size = 50
	out := domain.OrganizerPage{Items: []domain.Organizer{}, Page: page, PageSize: size}
	if err := r.db.QueryRowContext(ctx, `SELECT count(*) FROM users WHERE role='organizer' AND approval_status='approved'`).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT u.id,u.full_name,COALESCE(u.username,''),COALESCE(u.email,''),u.active,u.verified,
		(SELECT count(*) FROM tournaments t WHERE t.organizer_id=u.id),u.created_at
		FROM users u WHERE u.role='organizer' AND u.approval_status='approved'
		ORDER BY u.created_at DESC,u.id LIMIT $1 OFFSET $2`, size, (page-1)*size)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var o domain.Organizer
		if err = rows.Scan(&o.ID, &o.FullName, &o.Username, &o.Email, &o.Active, &o.Verified, &o.Tournaments, &o.CreatedAt); err != nil {
			rows.Close()
			return out, err
		}
		o.CreatedAt = o.CreatedAt.UTC()
		out.Items = append(out.Items, o)
	}
	out.TotalPages = (out.Total + size - 1) / size
	return out, closeRows(rows)
}

// CreateOrganizer opens an active, verified organizer account. Only
// administrators open organizer accounts (22 Oct 2026).
func (r *Postgres) CreateOrganizer(ctx context.Context, u authdomain.User) (domain.Organizer, error) {
	_, err := r.db.ExecContext(ctx, `INSERT INTO users(id,full_name,email,username,password_hash,role,city,active,verified,created_at) VALUES($1,$2,NULLIF($3,''),$4,$5,'organizer',$6,true,true,$7)`,
		u.ID, u.FullName, u.Email, u.Username, u.PasswordHash, u.City, u.CreatedAt)
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		switch pg.ConstraintName {
		case "users_email_key":
			return domain.Organizer{}, authdomain.ErrEmailExists
		case "users_username_key":
			return domain.Organizer{}, authdomain.ErrUsernameExists
		}
	}
	if err != nil {
		return domain.Organizer{}, err
	}
	return domain.Organizer{ID: u.ID, FullName: u.FullName, Username: u.Username, Email: u.Email, Active: true, Verified: true, CreatedAt: u.CreatedAt}, nil
}
