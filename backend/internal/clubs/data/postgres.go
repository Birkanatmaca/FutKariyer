package data

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"futcareer/backend/internal/clubs/domain"
)

type Postgres struct{ db *sql.DB }

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

const profileColumns = `u.id,u.full_name,c.football_type,c.district,c.description,c.venue_name,c.venue_address,c.training_ground_name,c.training_ground_address,c.training_schedule,c.updated_at,c.tff_season,c.tff_league,c.tff_group,c.tff_team,c.tff_label`

func scanProfile(row *sql.Row) (domain.Profile, error) {
	var p domain.Profile
	var tff domain.TFFLink
	err := row.Scan(&p.UserID, &p.Name, &p.FootballType, &p.District, &p.Description, &p.VenueName, &p.VenueAddress, &p.TrainingGroundName, &p.TrainingGroundAddress, &p.TrainingSchedule, &p.UpdatedAt, &tff.Season, &tff.League, &tff.Group, &tff.Team, &tff.Label)
	if errors.Is(err, sql.ErrNoRows) {
		return p, domain.ErrNotFound
	}
	if tff.Team != "" {
		p.TFF = &tff
	}
	p.UpdatedAt = p.UpdatedAt.UTC()
	return p, err
}

func (r *Postgres) Profile(ctx context.Context, userID string) (domain.Profile, error) {
	return scanProfile(r.db.QueryRowContext(ctx, `SELECT `+profileColumns+` FROM clubs c JOIN users u ON u.id=c.user_id WHERE c.user_id=$1 AND u.role='club'`, userID))
}

func (r *Postgres) UpdateProfile(ctx context.Context, userID string, p domain.Profile) (domain.Profile, error) {
	_, err := r.db.ExecContext(ctx, `UPDATE clubs SET district=$2,description=$3,venue_name=$4,venue_address=$5,training_ground_name=$6,training_ground_address=$7,training_schedule=$8,updated_at=now() WHERE user_id=$1`,
		userID, p.District, p.Description, p.VenueName, p.VenueAddress, p.TrainingGroundName, p.TrainingGroundAddress, p.TrainingSchedule)
	if err != nil {
		return p, err
	}
	return r.Profile(ctx, userID)
}

// SetTFF links the club to a TFF Ankara team, or unlinks it with nil.
func (r *Postgres) SetTFF(ctx context.Context, userID string, link *domain.TFFLink) (domain.Profile, error) {
	var l domain.TFFLink
	if link != nil {
		l = *link
	}
	res, err := r.db.ExecContext(ctx, `UPDATE clubs SET tff_season=$2,tff_league=$3,tff_group=$4,tff_team=$5,tff_label=$6,updated_at=now() WHERE user_id=$1`,
		userID, l.Season, l.League, l.Group, l.Team, l.Label)
	if err != nil {
		return domain.Profile{}, err
	}
	if n, err := res.RowsAffected(); err != nil || n == 0 {
		if err != nil {
			return domain.Profile{}, err
		}
		return domain.Profile{}, domain.ErrNotFound
	}
	return r.Profile(ctx, userID)
}

func (r *Postgres) Counts(ctx context.Context, userID string) (domain.Counts, error) {
	var out domain.Counts
	err := r.db.QueryRowContext(ctx, `SELECT
		(SELECT count(*) FROM team_join_requests WHERE club_user_id=$1 AND status='pending'),
		(SELECT count(*) FROM news_articles WHERE author_user_id=$1 AND review_status='pending'),
		(SELECT count(*) FROM news_articles WHERE author_user_id=$1 AND published),
		(SELECT count(*) FROM club_squad_members WHERE club_user_id=$1 AND left_at IS NULL)`, userID).
		Scan(&out.PendingApplications, &out.PendingNews, &out.PublishedNews, &out.SquadCount)
	return out, err
}

// LeagueIDs returns the public leagues the club is registered in, newest first.
func (r *Postgres) LeagueIDs(ctx context.Context, userID string) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT lt.league_id FROM league_teams lt JOIN leagues l ON l.id=lt.league_id WHERE lt.club_user_id=$1 AND l.status IN ('active','finished') ORDER BY l.created_at DESC,l.id DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// CoachLinks returns the coach's active staff places, oldest first, and how
// many club invitations wait for an answer.
func (r *Postgres) CoachLinks(ctx context.Context, coachID string) ([]domain.StaffLink, int, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT u.id,u.full_name,u.avatar_version,COALESCE(NULLIF(c.district,''),u.district,''),s.role,array_to_string(s.permissions,',')
		FROM club_staff s JOIN users u ON u.id=s.club_user_id AND u.active JOIN clubs c ON c.user_id=u.id
		WHERE s.coach_user_id=$1 AND s.status='active' ORDER BY s.joined_at,lower(u.full_name)`, coachID)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []domain.StaffLink{}
	for rows.Next() {
		var l domain.StaffLink
		var permissions string
		if err := rows.Scan(&l.ClubID, &l.ClubName, &l.AvatarVersion, &l.District, &l.Role, &permissions); err != nil {
			return nil, 0, err
		}
		l.Permissions = []string{}
		for _, p := range strings.Split(permissions, ",") {
			if p != "" {
				l.Permissions = append(l.Permissions, p)
			}
		}
		out = append(out, l)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	var invitations int
	err = r.db.QueryRowContext(ctx, `SELECT count(*) FROM club_staff s JOIN users u ON u.id=s.club_user_id AND u.active WHERE s.coach_user_id=$1 AND s.status='invited'`, coachID).Scan(&invitations)
	return out, invitations, err
}

// AvatarVersions returns the profile photo version of each active account;
// accounts without a photo report 0.
func (r *Postgres) AvatarVersions(ctx context.Context, ids []string) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id,avatar_version FROM users WHERE id=ANY($1) AND active`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var id string
		var version int
		if err := rows.Scan(&id, &version); err != nil {
			return nil, err
		}
		out[id] = version
	}
	return out, rows.Err()
}

func (r *Postgres) AdminOverviewAccount(ctx context.Context, userID string) (string, bool, error) {
	var email string
	var active bool
	err := r.db.QueryRowContext(ctx, `SELECT COALESCE(u.email,''),u.active FROM users u JOIN clubs c ON c.user_id=u.id WHERE u.id=$1`, userID).Scan(&email, &active)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, domain.ErrNotFound
	}
	return email, active, err
}

func (r *Postgres) News(ctx context.Context, userID string) ([]domain.NewsItem, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id,title,review_status,published,created_at FROM news_articles WHERE author_user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.NewsItem{}
	for rows.Next() {
		var n domain.NewsItem
		if err := rows.Scan(&n.ID, &n.Title, &n.ReviewStatus, &n.Published, &n.CreatedAt); err != nil {
			return nil, err
		}
		n.CreatedAt = n.CreatedAt.UTC()
		out = append(out, n)
	}
	return out, rows.Err()
}

func (r *Postgres) Applications(ctx context.Context, userID string) ([]domain.ApplicationItem, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT t.id,u.full_name,t.status,t.created_at FROM team_join_requests t JOIN users u ON u.id=t.player_id WHERE t.club_user_id=$1 ORDER BY t.created_at DESC,t.id DESC LIMIT 50`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.ApplicationItem{}
	for rows.Next() {
		var a domain.ApplicationItem
		if err := rows.Scan(&a.ID, &a.PlayerName, &a.Status, &a.CreatedAt); err != nil {
			return nil, err
		}
		a.CreatedAt = a.CreatedAt.UTC()
		out = append(out, a)
	}
	return out, rows.Err()
}

func (r *Postgres) Squad(ctx context.Context, clubID string) ([]domain.SquadMember, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT u.id,u.full_name,COALESCE(p.position,''),COALESCE(p.football_type,'unknown'),m.joined_at
		FROM club_squad_members m JOIN users u ON u.id=m.player_id AND u.active LEFT JOIN player_profiles p ON p.user_id=u.id
		WHERE m.club_user_id=$1 AND m.left_at IS NULL ORDER BY m.joined_at DESC,u.id LIMIT 200`, clubID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.SquadMember{}
	for rows.Next() {
		var m domain.SquadMember
		if err := rows.Scan(&m.PlayerID, &m.Name, &m.Position, &m.FootballType, &m.JoinedAt); err != nil {
			return nil, err
		}
		m.JoinedAt = m.JoinedAt.UTC()
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *Postgres) RemoveMember(ctx context.Context, clubID, playerID string) error {
	res, err := r.db.ExecContext(ctx, `UPDATE club_squad_members SET left_at=clock_timestamp() WHERE club_user_id=$1 AND player_id=$2 AND left_at IS NULL`, clubID, playerID)
	if err != nil {
		return err
	}
	if n, err := res.RowsAffected(); err != nil || n == 0 {
		if err != nil {
			return err
		}
		return domain.ErrNotMember
	}
	return nil
}

func (r *Postgres) Memberships(ctx context.Context, playerID string) ([]domain.Membership, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT u.id,u.full_name,c.district,m.joined_at
		FROM club_squad_members m JOIN users u ON u.id=m.club_user_id AND u.active JOIN clubs c ON c.user_id=u.id
		WHERE m.player_id=$1 AND m.left_at IS NULL ORDER BY m.joined_at DESC`, playerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Membership{}
	for rows.Next() {
		var m domain.Membership
		if err := rows.Scan(&m.ClubID, &m.ClubName, &m.District, &m.JoinedAt); err != nil {
			return nil, err
		}
		m.JoinedAt = m.JoinedAt.UTC()
		out = append(out, m)
	}
	return out, rows.Err()
}
