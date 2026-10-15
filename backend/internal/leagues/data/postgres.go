package data

import (
	"context"
	"database/sql"
	"errors"

	"futcareer/backend/internal/leagues/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

func league(row interface{ Scan(...any) error }) (domain.League, error) {
	var out domain.League
	err := row.Scan(&out.ID, &out.Name, &out.Season, &out.Description, &out.Status, &out.WinPoints, &out.DrawPoints, &out.LossPoints, &out.CreatedAt, &out.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return out, domain.ErrNotFound
	}
	return out, err
}

const leagueColumns = `id,name,season,description,status,win_points,draw_points,loss_points,created_at,updated_at`

func (r *Postgres) List(ctx context.Context, admin bool, page int) (domain.Page[domain.League], error) {
	out := domain.Page[domain.League]{Items: []domain.League{}, Page: page, PageSize: 20}
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return out, err
	}
	defer tx.Rollback()
	const where = ` WHERE ($1 OR status IN ('active','finished'))`
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM leagues`+where, admin).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := tx.QueryContext(ctx, `SELECT `+leagueColumns+` FROM leagues`+where+` ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET $2`, admin, (page-1)*20)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		item, e := league(rows)
		if e != nil {
			return out, e
		}
		out.Items = append(out.Items, item)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if err = rows.Close(); err != nil {
		return out, err
	}
	out.TotalPages = (out.Total + 19) / 20
	return out, tx.Commit()
}

func (r *Postgres) Get(ctx context.Context, id string, admin bool) (domain.Detail, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return domain.Detail{}, err
	}
	defer tx.Rollback()
	out := domain.Detail{Teams: []domain.Team{}, Matches: []domain.Match{}, Standings: []domain.Standing{}}
	value, err := league(tx.QueryRowContext(ctx, `SELECT `+leagueColumns+` FROM leagues WHERE id=$1 AND ($2 OR status IN ('active','finished'))`, id, admin))
	if err != nil {
		return out, err
	}
	out.League = value
	teams, err := tx.QueryContext(ctx, `SELECT t.id,t.club_user_id,u.full_name,c.district FROM league_teams t JOIN users u ON u.id=t.club_user_id JOIN clubs c ON c.user_id=u.id WHERE t.league_id=$1 ORDER BY lower(u.full_name),u.id`, id)
	if err != nil {
		return out, err
	}
	for teams.Next() {
		var item domain.Team
		if err = teams.Scan(&item.ID, &item.ClubID, &item.Name, &item.District); err != nil {
			teams.Close()
			return out, err
		}
		out.Teams = append(out.Teams, item)
	}
	if err = teams.Err(); err != nil {
		teams.Close()
		return out, err
	}
	if err = teams.Close(); err != nil {
		return out, err
	}
	rows, err := tx.QueryContext(ctx, `SELECT m.id,m.round,m.home_team_id,m.away_team_id,h.full_name,a.full_name,m.kickoff_at,m.home_goals,m.away_goals FROM league_matches m JOIN league_teams ht ON ht.id=m.home_team_id AND ht.league_id=m.league_id JOIN users h ON h.id=ht.club_user_id JOIN league_teams at ON at.id=m.away_team_id AND at.league_id=m.league_id JOIN users a ON a.id=at.club_user_id WHERE m.league_id=$1 ORDER BY m.round,m.kickoff_at NULLS LAST,m.id`, id)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		item, e := scanMatch(rows)
		if e != nil {
			rows.Close()
			return out, e
		}
		out.Matches = append(out.Matches, item)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return out, err
	}
	if err = rows.Close(); err != nil {
		return out, err
	}
	standings, err := tx.QueryContext(ctx, `WITH totals AS (
    SELECT t.id,t.club_user_id,
      count(m.id) FILTER (WHERE m.home_goals IS NOT NULL) AS played,
      count(m.id) FILTER (WHERE m.home_goals IS NOT NULL AND ((m.home_team_id=t.id AND m.home_goals>m.away_goals) OR (m.away_team_id=t.id AND m.away_goals>m.home_goals))) AS wins,
      count(m.id) FILTER (WHERE m.home_goals IS NOT NULL AND m.home_goals=m.away_goals) AS draws,
      count(m.id) FILTER (WHERE m.home_goals IS NOT NULL AND ((m.home_team_id=t.id AND m.home_goals<m.away_goals) OR (m.away_team_id=t.id AND m.away_goals<m.home_goals))) AS losses,
      COALESCE(sum(CASE WHEN m.home_team_id=t.id THEN m.home_goals ELSE m.away_goals END) FILTER (WHERE m.home_goals IS NOT NULL),0) AS goals_for,
      COALESCE(sum(CASE WHEN m.home_team_id=t.id THEN m.away_goals ELSE m.home_goals END) FILTER (WHERE m.home_goals IS NOT NULL),0) AS goals_against
    FROM league_teams t LEFT JOIN league_matches m ON m.league_id=t.league_id AND (m.home_team_id=t.id OR m.away_team_id=t.id)
    WHERE t.league_id=$1 GROUP BY t.id,t.club_user_id
  )
  SELECT row_number() OVER (ORDER BY (x.wins*l.win_points+x.draws*l.draw_points+x.losses*l.loss_points) DESC,(x.goals_for-x.goals_against) DESC,x.goals_for DESC,x.wins DESC,lower(u.full_name),u.id),
    x.id,x.club_user_id,u.full_name,x.played,x.wins,x.draws,x.losses,x.goals_for,x.goals_against,(x.goals_for-x.goals_against),(x.wins*l.win_points+x.draws*l.draw_points+x.losses*l.loss_points)
  FROM totals x JOIN users u ON u.id=x.club_user_id CROSS JOIN leagues l WHERE l.id=$1
  ORDER BY (x.wins*l.win_points+x.draws*l.draw_points+x.losses*l.loss_points) DESC,(x.goals_for-x.goals_against) DESC,x.goals_for DESC,x.wins DESC,lower(u.full_name),u.id`, id)
	if err != nil {
		return out, err
	}
	for standings.Next() {
		var item domain.Standing
		if err = standings.Scan(&item.Position, &item.TeamID, &item.ClubID, &item.TeamName, &item.Played, &item.Wins, &item.Draws, &item.Losses, &item.GoalsFor, &item.GoalsAgainst, &item.GoalDiff, &item.Points); err != nil {
			standings.Close()
			return out, err
		}
		out.Standings = append(out.Standings, item)
	}
	if err = standings.Err(); err != nil {
		standings.Close()
		return out, err
	}
	if err = standings.Close(); err != nil {
		return out, err
	}
	var avg sql.NullFloat64
	err = tx.QueryRowContext(ctx, `SELECT (SELECT count(*) FROM league_teams WHERE league_id=$1),count(*),count(*) FILTER (WHERE home_goals IS NOT NULL),COALESCE(count(*) FILTER (WHERE home_goals IS NULL),0),COALESCE(sum(home_goals+away_goals) FILTER (WHERE home_goals IS NOT NULL),0),COALESCE(avg(home_goals+away_goals) FILTER (WHERE home_goals IS NOT NULL),0),count(*) FILTER (WHERE home_goals>away_goals),count(*) FILTER (WHERE home_goals=away_goals AND home_goals IS NOT NULL),count(*) FILTER (WHERE home_goals<away_goals) FROM league_matches WHERE league_id=$1`, id).Scan(&out.Statistics.TeamCount, &out.Statistics.MatchCount, &out.Statistics.PlayedMatches, &out.Statistics.ScheduledMatches, &out.Statistics.TotalGoals, &avg, &out.Statistics.HomeWins, &out.Statistics.Draws, &out.Statistics.AwayWins)
	if err != nil {
		return out, err
	}
	out.Statistics.AverageGoals = avg.Float64
	return out, tx.Commit()
}

func (r *Postgres) Save(ctx context.Context, in domain.League, create bool) (domain.League, error) {
	if create {
		return league(r.db.QueryRowContext(ctx, `INSERT INTO leagues(id,name,season,description,status,win_points,draw_points,loss_points) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING `+leagueColumns, in.ID, in.Name, in.Season, in.Description, in.Status, in.WinPoints, in.DrawPoints, in.LossPoints))
	}
	return league(r.db.QueryRowContext(ctx, `UPDATE leagues SET name=$2,season=$3,description=$4,status=$5,win_points=$6,draw_points=$7,loss_points=$8,updated_at=now() WHERE id=$1 RETURNING `+leagueColumns, in.ID, in.Name, in.Season, in.Description, in.Status, in.WinPoints, in.DrawPoints, in.LossPoints))
}

func (r *Postgres) Delete(ctx context.Context, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM leagues WHERE id=$1`, id)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err == nil && n == 0 {
		return domain.ErrNotFound
	}
	return err
}

func (r *Postgres) Clubs(ctx context.Context, search string, page int) (domain.Page[domain.ClubOption], error) {
	out := domain.Page[domain.ClubOption]{Items: []domain.ClubOption{}, Page: page, PageSize: 20}
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return out, err
	}
	defer tx.Rollback()
	const where = ` FROM users u JOIN clubs c ON c.user_id=u.id WHERE u.role='club' AND u.active AND ($1='' OR strpos(lower(u.full_name),lower($1))>0)`
	if err = tx.QueryRowContext(ctx, `SELECT count(*)`+where, search).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := tx.QueryContext(ctx, `SELECT u.id,u.full_name`+where+` ORDER BY lower(u.full_name),u.id LIMIT 20 OFFSET $2`, search, (page-1)*20)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var v domain.ClubOption
		if err = rows.Scan(&v.ID, &v.FullName); err != nil {
			return out, err
		}
		out.Items = append(out.Items, v)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if err = rows.Close(); err != nil {
		return out, err
	}
	out.TotalPages = (out.Total + 19) / 20
	return out, tx.Commit()
}

func (r *Postgres) AddTeam(ctx context.Context, leagueID, clubID, id string) (domain.Team, error) {
	var out domain.Team
	err := r.db.QueryRowContext(ctx, `WITH added AS (
    INSERT INTO league_teams(id,league_id,club_user_id)
    SELECT $3,l.id,u.id FROM leagues l JOIN users u ON u.id=$2 JOIN clubs c ON c.user_id=u.id AND u.active AND u.role='club' WHERE l.id=$1
    ON CONFLICT (league_id,club_user_id) DO UPDATE SET club_user_id=EXCLUDED.club_user_id
    RETURNING id,league_id,club_user_id
  ) SELECT a.id,a.club_user_id,u.full_name,c.district FROM added a JOIN users u ON u.id=a.club_user_id JOIN clubs c ON c.user_id=u.id`, leagueID, clubID, id).Scan(&out.ID, &out.ClubID, &out.Name, &out.District)
	if errors.Is(err, sql.ErrNoRows) {
		return out, domain.ErrNotFound
	}
	return out, err
}

func (r *Postgres) RemoveTeam(ctx context.Context, leagueID, teamID string) error {
	var used bool
	err := r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM league_matches WHERE league_id=$1 AND (home_team_id=$2 OR away_team_id=$2))`, leagueID, teamID).Scan(&used)
	if err != nil {
		return err
	}
	if used {
		return domain.ErrTeamHasMatches
	}
	result, err := r.db.ExecContext(ctx, `DELETE FROM league_teams WHERE league_id=$1 AND id=$2`, leagueID, teamID)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err == nil && n == 0 {
		return domain.ErrNotFound
	}
	return err
}

func scanMatch(row interface{ Scan(...any) error }) (domain.Match, error) {
	var out domain.Match
	var kickoff sql.NullTime
	var home, away sql.NullInt64
	err := row.Scan(&out.ID, &out.Round, &out.HomeTeamID, &out.AwayTeamID, &out.HomeName, &out.AwayName, &kickoff, &home, &away)
	if errors.Is(err, sql.ErrNoRows) {
		return out, domain.ErrNotFound
	}
	if err != nil {
		return out, err
	}
	if kickoff.Valid {
		value := kickoff.Time.UTC()
		out.KickoffAt = &value
	}
	if home.Valid {
		value := int(home.Int64)
		out.HomeGoals = &value
	}
	if away.Valid {
		value := int(away.Int64)
		out.AwayGoals = &value
	}
	return out, nil
}

func (r *Postgres) SaveMatch(ctx context.Context, leagueID string, in domain.Match, create bool) (domain.Match, error) {
	if create {
		query := `WITH added AS (INSERT INTO league_matches(id,league_id,round,home_team_id,away_team_id,kickoff_at,home_goals,away_goals)
  SELECT $1,$2,$3,$4,$5,$6,$7,$8 WHERE $4<>$5 AND EXISTS(SELECT 1 FROM league_teams WHERE id=$4 AND league_id=$2) AND EXISTS(SELECT 1 FROM league_teams WHERE id=$5 AND league_id=$2)
  RETURNING *) SELECT m.id,m.round,m.home_team_id,m.away_team_id,h.full_name,a.full_name,m.kickoff_at,m.home_goals,m.away_goals FROM added m JOIN league_teams ht ON ht.id=m.home_team_id AND ht.league_id=m.league_id JOIN users h ON h.id=ht.club_user_id JOIN league_teams at ON at.id=m.away_team_id AND at.league_id=m.league_id JOIN users a ON a.id=at.club_user_id`
		return scanMatch(r.db.QueryRowContext(ctx, query, in.ID, leagueID, in.Round, in.HomeTeamID, in.AwayTeamID, in.KickoffAt, in.HomeGoals, in.AwayGoals))
	}
	query := `WITH changed AS (UPDATE league_matches SET round=$3,home_team_id=$4,away_team_id=$5,kickoff_at=$6,home_goals=$7,away_goals=$8,updated_at=now() WHERE id=$1 AND league_id=$2 AND $4<>$5 AND EXISTS(SELECT 1 FROM league_teams WHERE id=$4 AND league_id=$2) AND EXISTS(SELECT 1 FROM league_teams WHERE id=$5 AND league_id=$2) RETURNING *) SELECT c.id,c.round,c.home_team_id,c.away_team_id,h.full_name,a.full_name,c.kickoff_at,c.home_goals,c.away_goals FROM changed c JOIN league_teams ht ON ht.id=c.home_team_id JOIN users h ON h.id=ht.club_user_id JOIN league_teams at ON at.id=c.away_team_id JOIN users a ON a.id=at.club_user_id`
	return scanMatch(r.db.QueryRowContext(ctx, query, in.ID, leagueID, in.Round, in.HomeTeamID, in.AwayTeamID, in.KickoffAt, in.HomeGoals, in.AwayGoals))
}

func (r *Postgres) DeleteMatch(ctx context.Context, leagueID, matchID string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM league_matches WHERE league_id=$1 AND id=$2`, leagueID, matchID)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err == nil && n == 0 {
		return domain.ErrNotFound
	}
	return err
}
