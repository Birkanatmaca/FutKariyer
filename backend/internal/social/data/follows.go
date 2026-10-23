package data

import (
	"context"
	"database/sql"
	"errors"

	moderation "futcareer/backend/internal/moderation/data"
	"futcareer/backend/internal/social/domain"
)

var _ domain.FollowLister = (*Postgres)(nil)

// Follows pages who follows userID (followers) or whom userID follows,
// newest first. The list owner must be an active author the viewer may see;
// listed accounts are active authors not blocked either way with the viewer.
func (r *Postgres) Follows(ctx context.Context, viewerID, userID string, followers bool, after domain.Cursor) ([]domain.FollowEntry, error) {
	var visible bool
	err := r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM users u WHERE u.id=$2 AND `+activeAuthor+` AND `+visibleToViewer+`)`, viewerID, userID).Scan(&visible)
	if err != nil {
		return nil, err
	}
	if !visible {
		return nil, domain.ErrNotFound
	}
	// other is the listed account: the follower or the followed one.
	other, owner := "f.follower_id", "f.profile_id"
	if !followers {
		other, owner = "f.profile_id", "f.follower_id"
	}
	rows, err := r.db.QueryContext(ctx, `SELECT u.id,u.full_name,u.role,u.verified,u.avatar_version,
		CASE WHEN u.role='club' THEN COALESCE((SELECT football_type FROM clubs WHERE user_id=u.id),'unknown')
		  WHEN u.role='player' THEN COALESCE((SELECT CASE WHEN discoverable THEN football_type ELSE 'unknown' END FROM player_profiles WHERE user_id=u.id),'unknown')
		  ELSE 'unknown' END,
		EXISTS(SELECT 1 FROM pro_memberships pm WHERE pm.user_id=u.id AND pm.expires_at>now()),
		EXISTS(SELECT 1 FROM profile_follows mine WHERE mine.profile_id=u.id AND mine.follower_id=$1),
		f.created_at
		FROM profile_follows f JOIN users u ON u.id=`+other+`
		WHERE `+owner+`=$2 AND `+activeAuthor+` AND `+moderation.NotBlocked("$1", "u.id")+`
		  AND ($3='' OR (f.created_at,u.id)<($4::timestamptz,$3))
		ORDER BY f.created_at DESC,u.id DESC LIMIT $5`, viewerID, userID, after.ID, after.CreatedAt, domain.PageSize+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.FollowEntry{}
	for rows.Next() {
		var e domain.FollowEntry
		if err := rows.Scan(&e.ID, &e.FullName, &e.Role, &e.Verified, &e.AvatarVersion, &e.FootballType, &e.IsPro, &e.Author.Following, &e.FollowedAt); err != nil {
			return nil, err
		}
		e.FollowedAt = e.FollowedAt.UTC()
		out = append(out, e)
	}
	if err := rows.Err(); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	return out, nil
}
