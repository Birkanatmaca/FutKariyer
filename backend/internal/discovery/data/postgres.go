package data

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"futcareer/backend/internal/discovery/domain"
	players "futcareer/backend/internal/players/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

const joins = ` FROM users u LEFT JOIN player_profiles p ON p.user_id=u.id LEFT JOIN clubs c ON c.user_id=u.id`
const visible = `u.active AND u.city='Ankara' AND u.role=$1 AND
	((u.role='player' AND p.discoverable) OR (u.role IN ('club','coach') AND u.verified))`
const columns = `u.id,u.full_name,u.role,u.verified,EXISTS(SELECT 1 FROM pro_memberships pm WHERE pm.user_id=u.id AND pm.expires_at>now()) AS is_pro,COALESCE(c.district,'') AS district,
	COALESCE(p.position,'') AS position,COALESCE(p.dominant_foot,'') AS dominant_foot,COALESCE(p.experience_years,0) AS experience_years,
	COALESCE(p.current_club,'') AS current_club,COALESCE(p.availability,'not_available') AS availability,COALESCE(p.football_type,'unknown') AS football_type,COALESCE(p.license_status,'unknown') AS license_status,p.updated_at`

type scanner interface{ Scan(...any) error }

func scan(row scanner) (domain.Profile, error) {
	var profile domain.Profile
	var player players.Profile
	var updated sql.NullTime
	err := row.Scan(&profile.ID, &profile.FullName, &profile.Role, &profile.Verified, &profile.IsPro, &profile.District,
		&player.Position, &player.DominantFoot, &player.ExperienceYears, &player.CurrentClub, &player.Availability, &player.FootballType, &player.LicenseStatus, &updated)
	if errors.Is(err, sql.ErrNoRows) {
		return profile, domain.ErrNotFound
	}
	if err != nil {
		return profile, err
	}
	if profile.Role == "player" {
		player.UserID = profile.ID
		player.Discoverable = true
		player.UpdatedAt = updated.Time.UTC()
		profile.PlayerProfile = &player
	}
	return profile, nil
}

func (r *Postgres) List(ctx context.Context, q domain.Query) (domain.Page, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return domain.Page{}, err
	}
	defer tx.Rollback()
	result := domain.Page{Items: []domain.Profile{}}
	// Literal substring search prevents '%' and '_' from becoming SQL wildcards.
	where := ` WHERE ` + visible + ` AND u.id<>$8 AND ($2='' OR strpos(lower(u.full_name),$2)>0)
		AND ($3='' OR strpos(lower(p.position),$3)>0)
		AND ($4='' OR p.dominant_foot=$4) AND ($5='' OR p.availability=$5)
		AND ($6='' OR p.football_type=$6) AND ($7='' OR p.license_status=$7)`
	args := []any{q.Role, strings.ToLower(q.Search), strings.ToLower(q.Position), q.DominantFoot, q.Availability, q.FootballType, q.LicenseStatus, q.ViewerID}
	if err := tx.QueryRowContext(ctx, "SELECT count(*)"+joins+where, args...).Scan(&result.Total); err != nil {
		return result, err
	}
	args = append(args, q.PageSize, (q.Page-1)*q.PageSize)
	rows, err := tx.QueryContext(ctx, `WITH viewer AS (
		SELECT COALESCE((SELECT football_type FROM player_profiles WHERE user_id=$8),'unknown') football_type,
			COALESCE((SELECT license_status FROM player_profiles WHERE user_id=$8),'unknown') license_status
	), candidates AS (
		SELECT `+columns+`,u.created_at,
			CASE WHEN $1='player' THEN COALESCE(p.football_type,'unknown') ELSE u.role END AS category,
			(CASE WHEN p.football_type=v.football_type AND v.football_type<>'unknown' THEN 6 ELSE 0 END)
			+ CASE WHEN p.license_status=v.license_status AND v.license_status<>'unknown' THEN 2 ELSE 0 END AS relevance,
			ROW_NUMBER() OVER(PARTITION BY CASE WHEN $1='player' THEN COALESCE(p.football_type,'unknown') ELSE u.role END
				ORDER BY (CASE WHEN p.football_type=v.football_type AND v.football_type<>'unknown' THEN 6 ELSE 0 END)
					+ (CASE WHEN p.license_status=v.license_status AND v.license_status<>'unknown' THEN 2 ELSE 0 END) DESC,u.created_at DESC,u.id DESC) AS category_rank
		`+joins+` CROSS JOIN viewer v`+where+`
	)
	SELECT id,full_name,role,verified,is_pro,district,position,dominant_foot,experience_years,current_club,availability,football_type,license_status,updated_at
	FROM candidates ORDER BY CASE WHEN $1='player' THEN category_rank END ASC NULLS LAST,relevance DESC,created_at DESC,id DESC LIMIT $9 OFFSET $10`, args...)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		profile, err := scan(rows)
		if err != nil {
			return result, err
		}
		result.Items = append(result.Items, profile)
	}
	if err = rows.Err(); err != nil {
		return result, err
	}
	if err = rows.Close(); err != nil {
		return result, err
	}
	return result, tx.Commit()
}

func (r *Postgres) Get(ctx context.Context, role, id string) (domain.Profile, error) {
	return scan(r.db.QueryRowContext(ctx, "SELECT "+columns+joins+" WHERE "+visible+" AND u.id=$2", role, id))
}

// Re-check the current actor and target in the write itself, so revoked access cannot create events.
const actorAllowed = ` AND EXISTS(SELECT 1 FROM users v WHERE v.id=$3 AND v.active AND v.id<>u.id AND
	((v.role='player' AND u.role IN ('player','club','coach')) OR (v.role IN ('club','coach') AND v.verified AND u.role='player')))`

// RecordView keeps one row per viewer and UTC day. A view is private only while the
// viewer is Pro with private browsing on; once a day is private it stays private.
func (r *Postgres) RecordView(ctx context.Context, role, id, viewer string) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO profile_views(profile_id,viewer_id,last_viewed_at,private)
		SELECT u.id,$3,now(),EXISTS(SELECT 1 FROM pro_memberships pm WHERE pm.user_id=$3 AND pm.expires_at>now() AND pm.private_browsing)`+joins+` WHERE `+visible+` AND u.id=$2`+actorAllowed+`
		ON CONFLICT(profile_id,viewer_id,viewed_on) DO UPDATE SET last_viewed_at=EXCLUDED.last_viewed_at,private=profile_views.private OR EXCLUDED.private`, role, id, viewer)
	return err
}
func (r *Postgres) Following(ctx context.Context, id, viewer string) (bool, error) {
	var out bool
	err := r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM profile_follows WHERE profile_id=$1 AND follower_id=$2)`, id, viewer).Scan(&out)
	return out, err
}
func (r *Postgres) Follow(ctx context.Context, role, id, viewer string, on bool) error {
	if !on {
		_, err := r.db.ExecContext(ctx, `DELETE FROM profile_follows WHERE profile_id=$1 AND follower_id=$2`, id, viewer)
		return err
	}
	// The CTE distinguishes an already-followed profile from a profile no longer accessible.
	var allowed bool
	err := r.db.QueryRowContext(ctx, `WITH allowed AS(SELECT u.id`+joins+` WHERE `+visible+` AND u.id=$2`+actorAllowed+`), inserted AS(INSERT INTO profile_follows(profile_id,follower_id) SELECT id,$3 FROM allowed ON CONFLICT DO NOTHING) SELECT EXISTS(SELECT 1 FROM allowed)`, role, id, viewer).Scan(&allowed)
	if err == nil && !allowed {
		return domain.ErrNotFound
	}
	return err
}
func (r *Postgres) Insights(ctx context.Context, id string) (domain.Insights, error) {
	var out domain.Insights
	err := r.db.QueryRowContext(ctx, `SELECT
      (SELECT count(*) FROM profile_views WHERE profile_id=$1),
      (SELECT count(*) FROM profile_follows f JOIN users u ON u.id=f.follower_id WHERE f.profile_id=$1 AND u.active),
      (SELECT count(*) FROM profile_follows f JOIN users u ON u.id=f.profile_id WHERE f.follower_id=$1 AND u.active)`, id).Scan(&out.ProfileViews, &out.Followers, &out.Following)
	return out, err
}

// Visitors aggregates the active visitors of the last VisitorWindowDays UTC days.
// CanOpen applies the discovery list/detail rule from the owner's point of view.
func (r *Postgres) Visitors(ctx context.Context, ownerID string) (domain.VisitorOwner, []domain.Visit, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return domain.VisitorOwner{}, nil, err
	}
	defer tx.Rollback()
	owner := domain.VisitorOwner{ID: ownerID}
	var ownerVerified bool
	err = tx.QueryRowContext(ctx, `SELECT u.role,u.verified,
		CASE WHEN u.role='player' THEN COALESCE(p.football_type,'unknown') WHEN u.role='club' THEN COALESCE(c.football_type,'unknown') ELSE 'unknown' END,
		EXISTS(SELECT 1 FROM pro_memberships pm WHERE pm.user_id=u.id AND pm.expires_at>now())`+joins+` WHERE u.id=$1 AND u.active`, ownerID).Scan(&owner.Role, &ownerVerified, &owner.FootballType, &owner.IsPro)
	if errors.Is(err, sql.ErrNoRows) {
		return owner, nil, domain.ErrForbidden
	}
	if err != nil {
		return owner, nil, err
	}
	rows, err := tx.QueryContext(ctx, `WITH today AS (SELECT (now() AT TIME ZONE 'UTC')::date AS d),
	agg AS (
		SELECT v.viewer_id,count(*) AS days,max(v.last_viewed_at) AS last_at,bool_or(v.private) AS private,
			count(*) FILTER (WHERE v.viewed_on>t.d-7) AS week_days
		FROM profile_views v CROSS JOIN today t
		WHERE v.profile_id=$1 AND v.viewed_on>t.d-$2::int
		GROUP BY v.viewer_id
	)
	SELECT u.id,u.full_name,u.role,u.verified,
		EXISTS(SELECT 1 FROM pro_memberships pm WHERE pm.user_id=u.id AND pm.expires_at>now()),
		CASE WHEN u.role='player' AND p.discoverable THEN p.football_type WHEN u.role='club' THEN COALESCE(c.football_type,'unknown') ELSE 'unknown' END,
		CASE WHEN u.role='player' AND p.discoverable THEN COALESCE(p.current_club,'') ELSE '' END,
		COALESCE(c.district,''),
		(u.city='Ankara' AND ((u.role='player' AND COALESCE(p.discoverable,false)) OR (u.role IN ('club','coach') AND u.verified))
			AND (($3='player' AND u.role IN ('player','club','coach')) OR ($3 IN ('club','coach') AND $4 AND u.role='player'))),
		a.private,a.days,a.week_days,a.last_at
	FROM agg a JOIN users u ON u.id=a.viewer_id
	LEFT JOIN player_profiles p ON p.user_id=u.id LEFT JOIN clubs c ON c.user_id=u.id
	WHERE u.active
	ORDER BY a.last_at DESC,u.id LIMIT 500`, ownerID, domain.VisitorWindowDays, owner.Role, ownerVerified)
	if err != nil {
		return owner, nil, err
	}
	defer rows.Close()
	visits := []domain.Visit{}
	for rows.Next() {
		var v domain.Visit
		if err := rows.Scan(&v.VisitorID, &v.FullName, &v.Role, &v.Verified, &v.IsPro, &v.FootballType, &v.Club, &v.District, &v.CanOpen, &v.Private, &v.Days, &v.WeekDays, &v.LastVisitedAt); err != nil {
			return owner, nil, err
		}
		v.ThisWeek = v.WeekDays > 0
		v.LastVisitedAt = v.LastVisitedAt.UTC()
		visits = append(visits, v)
	}
	if err = rows.Err(); err != nil {
		return owner, nil, err
	}
	if err = rows.Close(); err != nil {
		return owner, nil, err
	}
	return owner, visits, tx.Commit()
}
