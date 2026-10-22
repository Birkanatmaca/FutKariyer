package data

import (
	"context"
	"database/sql"
	"errors"

	"futcareer/backend/internal/social/domain"
)

var _ domain.ProfileReader = (*Postgres)(nil)

// discoveryAllowed mirrors the discovery rules (discovery/application
// authorize and data visible): viewer $1 may open author u's discovery profile.
const discoveryAllowed = `u.city='Ankara' AND ((u.role='player' AND COALESCE((SELECT discoverable FROM player_profiles WHERE user_id=u.id),false)) OR (u.role IN ('club','coach') AND u.verified))
	AND EXISTS(SELECT 1 FROM users v WHERE v.id=$1 AND v.active AND v.id<>u.id AND
		((v.role='player' AND u.role IN ('player','club','coach')) OR (v.role IN ('club','coach') AND v.verified AND u.role='player')))`

// Profile reads an active author's social profile and, when the viewer is
// someone else, records one profile view per viewer and UTC day (private
// while the viewer browses privately with Pro), as discovery profiles do.
func (r *Postgres) Profile(ctx context.Context, viewerID, userID string) (domain.Profile, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Profile{}, err
	}
	defer tx.Rollback()
	var p domain.Profile
	err = tx.QueryRowContext(ctx, `SELECT u.id,u.full_name,u.role,u.verified,u.avatar_version,
		CASE WHEN u.role='club' THEN COALESCE((SELECT football_type FROM clubs WHERE user_id=u.id),'unknown')
		  WHEN u.role='player' THEN COALESCE((SELECT CASE WHEN discoverable THEN football_type ELSE 'unknown' END FROM player_profiles WHERE user_id=u.id),'unknown')
		  ELSE 'unknown' END,
		CASE WHEN u.role='player' THEN COALESCE((SELECT CASE WHEN discoverable THEN license_status ELSE 'unknown' END FROM player_profiles WHERE user_id=u.id),'unknown')
		  ELSE 'unknown' END,
		EXISTS(SELECT 1 FROM pro_memberships pm WHERE pm.user_id=u.id AND pm.expires_at>now()),
		EXISTS(SELECT 1 FROM profile_follows f WHERE f.profile_id=u.id AND f.follower_id=$1),
		(SELECT count(*) FROM social_posts sp WHERE sp.author_id=u.id),
		(SELECT count(*) FROM profile_follows f JOIN users fu ON fu.id=f.follower_id AND fu.active WHERE f.profile_id=u.id),
		(SELECT count(*) FROM profile_follows f JOIN users fu ON fu.id=f.profile_id AND fu.active WHERE f.follower_id=u.id),
		u.id=$1,`+discoveryAllowed+`
		FROM users u WHERE u.id=$2 AND `+activeAuthor+` AND `+visibleToViewer, viewerID, userID).Scan(
		&p.ID, &p.FullName, &p.Role, &p.Verified, &p.AvatarVersion, &p.FootballType, &p.LicenseStatus, &p.IsPro, &p.Author.Following,
		&p.Posts, &p.Followers, &p.FollowingCount, &p.Self, &p.Discovery)
	if errors.Is(err, sql.ErrNoRows) {
		return p, domain.ErrNotFound
	}
	if err != nil {
		return p, err
	}
	if !p.Self {
		if _, err = tx.ExecContext(ctx, `INSERT INTO profile_views(profile_id,viewer_id,last_viewed_at,private)
			SELECT $2,v.id,now(),EXISTS(SELECT 1 FROM pro_memberships pm WHERE pm.user_id=v.id AND pm.expires_at>now() AND pm.private_browsing)
			FROM users v WHERE v.id=$1 AND v.active
			ON CONFLICT(profile_id,viewer_id,viewed_on) DO UPDATE SET last_viewed_at=EXCLUDED.last_viewed_at,private=profile_views.private OR EXCLUDED.private`, viewerID, userID); err != nil {
			return p, err
		}
	}
	return p, tx.Commit()
}
