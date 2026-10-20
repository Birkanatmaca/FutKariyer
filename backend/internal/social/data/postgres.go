package data

import (
	"context"
	"database/sql"
	"errors"

	moderation "futcareer/backend/internal/moderation/data"
	notifications "futcareer/backend/internal/notifications/data"
	notificationdomain "futcareer/backend/internal/notifications/domain"
	"futcareer/backend/internal/social/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

const activeAuthor = `u.active AND u.role IN ('player','club','coach')`

// visibleToViewer hides authors the viewer ($1) blocked or was blocked by.
var visibleToViewer = moderation.NotBlocked("$1", "u.id")

const postColumns = `p.id,u.id,u.full_name,u.role,u.verified,u.avatar_version,
 CASE WHEN u.role='club' THEN COALESCE((SELECT football_type FROM clubs WHERE user_id=u.id),'unknown')
  WHEN u.role='player' THEN COALESCE((SELECT CASE WHEN discoverable THEN football_type ELSE 'unknown' END FROM player_profiles WHERE user_id=u.id),'unknown')
  ELSE 'unknown' END,
 CASE WHEN u.role='player' THEN COALESCE((SELECT CASE WHEN discoverable THEN license_status ELSE 'unknown' END FROM player_profiles WHERE user_id=u.id),'unknown')
  ELSE 'unknown' END,p.body,p.created_at,
 (SELECT count(*) FROM social_likes l JOIN users lu ON lu.id=l.user_id WHERE l.post_id=p.id AND lu.active),
 (SELECT count(*) FROM social_replies r JOIN users ru ON ru.id=r.author_id WHERE r.post_id=p.id AND ru.active),
 EXISTS(SELECT 1 FROM social_likes l WHERE l.post_id=p.id AND l.user_id=$1),p.author_id=$1,
 EXISTS(SELECT 1 FROM profile_follows f WHERE f.profile_id=p.author_id AND f.follower_id=$1),
 p.media_kind,p.media_mime,p.media_size,p.media_width,p.media_height,
 EXISTS(SELECT 1 FROM pro_memberships pm WHERE pm.user_id=u.id AND pm.expires_at>now()),p.show_on_profile`

type scanner interface{ Scan(...any) error }
type queryer interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func scanPost(row scanner) (domain.Post, error) {
	var p domain.Post
	var media domain.Media
	err := row.Scan(&p.ID, &p.Author.ID, &p.Author.FullName, &p.Author.Role, &p.Author.Verified, &p.Author.AvatarVersion, &p.Author.FootballType, &p.Author.LicenseStatus, &p.Body, &p.CreatedAt, &p.LikeCount, &p.ReplyCount, &p.Liked, &p.Owned, &p.Author.Following, &media.Kind, &media.MIME, &media.Size, &media.Width, &media.Height, &p.Author.IsPro, &p.ShowOnProfile)
	if errors.Is(err, sql.ErrNoRows) {
		return p, domain.ErrNotFound
	}
	if media.Kind != "" {
		p.Media = &media
	}
	p.CreatedAt = p.CreatedAt.UTC()
	return p, err
}
func getPost(ctx context.Context, q queryer, userID, id string) (domain.Post, error) {
	return scanPost(q.QueryRowContext(ctx, `SELECT `+postColumns+` FROM social_posts p JOIN users u ON u.id=p.author_id WHERE p.id=$2 AND `+activeAuthor+` AND `+visibleToViewer, userID, id))
}
func (r *Postgres) GetPost(ctx context.Context, userID, id string) (domain.Post, error) {
	return getPost(ctx, r.db, userID, id)
}
func (r *Postgres) UserPosts(ctx context.Context, viewerID, authorID string, after domain.Cursor, profileMedia bool) ([]domain.Post, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+postColumns+` FROM social_posts p JOIN users u ON u.id=p.author_id
	WHERE p.author_id=$2 AND `+activeAuthor+` AND `+visibleToViewer+`
		AND (NOT $3 OR p.show_on_profile)
		AND ($4='' OR (p.created_at,p.id)<($5::timestamptz,$4))
	ORDER BY p.created_at DESC,p.id DESC LIMIT $6`, viewerID, authorID, profileMedia, after.ID, after.CreatedAt, domain.PageSize+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Post{}
	for rows.Next() {
		p, err := scanPost(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
func (r *Postgres) Feed(ctx context.Context, userID string, after domain.FeedCursor, following bool) ([]domain.Post, error) {
	rows, err := r.db.QueryContext(ctx, `WITH viewer AS (
		SELECT COALESCE((SELECT football_type FROM player_profiles WHERE user_id=$1),'unknown') AS football_type,
			COALESCE((SELECT license_status FROM player_profiles WHERE user_id=$1),'unknown') AS license_status
	), base AS (
		SELECT p.id,p.created_at,
			CASE WHEN u.role='player' THEN 'player:'||COALESCE(pp.football_type,'unknown')
				WHEN u.role='club' THEN 'club:'||COALESCE(c.football_type,'unknown') ELSE 'coach' END AS category,
			(CASE WHEN u.role='player' AND v.football_type<>'unknown' AND pp.football_type=v.football_type THEN 6
				WHEN u.role='club' AND v.football_type<>'unknown' AND c.football_type=v.football_type THEN 5 ELSE 0 END)
			+ CASE WHEN u.role='player' AND v.license_status<>'unknown' AND pp.license_status=v.license_status THEN 2 ELSE 0 END
			+ CASE WHEN EXISTS(SELECT 1 FROM profile_follows f WHERE f.profile_id=u.id AND f.follower_id=$1) THEN 3 ELSE 0 END
			+ CASE WHEN p.created_at>$2::timestamptz-interval '7 days' THEN 2
				WHEN p.created_at>$2::timestamptz-interval '30 days' THEN 1 ELSE 0 END AS relevance
		FROM social_posts p JOIN users u ON u.id=p.author_id
		LEFT JOIN player_profiles pp ON pp.user_id=u.id LEFT JOIN clubs c ON c.user_id=u.id
		CROSS JOIN viewer v
		WHERE `+activeAuthor+` AND `+visibleToViewer+` AND p.created_at<=$2::timestamptz
			AND (NOT $3 OR EXISTS(SELECT 1 FROM profile_follows f WHERE f.profile_id=p.author_id AND f.follower_id=$1))
	), ranked AS (
		SELECT id,created_at,category,relevance,
			ROW_NUMBER() OVER(PARTITION BY category ORDER BY relevance DESC,created_at DESC,id DESC) AS category_rank
		FROM base
	)
	SELECT `+postColumns+` FROM ranked x JOIN social_posts p ON p.id=x.id JOIN users u ON u.id=p.author_id
	WHERE `+activeAuthor+`
	ORDER BY CASE WHEN NOT $3 THEN x.category_rank END ASC NULLS LAST,
		CASE WHEN $3 THEN p.created_at END DESC,
		CASE WHEN NOT $3 THEN x.relevance END DESC,p.created_at DESC,p.id DESC
	LIMIT $5 OFFSET $4`, userID, after.SnapshotAt, following, after.Offset, domain.PageSize+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Post{}
	for rows.Next() {
		p, err := scanPost(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
func lockActor(ctx context.Context, tx *sql.Tx, userID string) (domain.Author, error) {
	var a domain.Author
	err := tx.QueryRowContext(ctx, `SELECT id,full_name,role,verified,avatar_version FROM users WHERE id=$1 AND active AND role IN ('player','club','coach') FOR UPDATE`, userID).Scan(&a.ID, &a.FullName, &a.Role, &a.Verified, &a.AvatarVersion)
	if errors.Is(err, sql.ErrNoRows) {
		return a, domain.ErrForbidden
	}
	return a, err
}

// lockPost locks a post the viewer may see; a block either way hides it, so
// blocked users cannot like or reply to each other's posts.
func lockPost(ctx context.Context, tx *sql.Tx, viewerID, id string) error {
	var found string
	err := tx.QueryRowContext(ctx, `SELECT p.id FROM social_posts p JOIN users u ON u.id=p.author_id WHERE p.id=$2 AND `+activeAuthor+` AND `+visibleToViewer+` FOR UPDATE OF p`, viewerID, id).Scan(&found)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ErrNotFound
	}
	return err
}
func consumeWriteSlot(ctx context.Context, tx *sql.Tx, userID string, reply bool) error {
	query := `INSERT INTO social_write_limits(user_id,last_post_at) VALUES($1,clock_timestamp())
 ON CONFLICT(user_id) DO UPDATE SET last_post_at=clock_timestamp()
 WHERE social_write_limits.last_post_at IS NULL OR social_write_limits.last_post_at<clock_timestamp()-interval '5 seconds' RETURNING user_id`
	if reply {
		query = `INSERT INTO social_write_limits(user_id,last_reply_at) VALUES($1,clock_timestamp())
 ON CONFLICT(user_id) DO UPDATE SET last_reply_at=clock_timestamp()
 WHERE social_write_limits.last_reply_at IS NULL OR social_write_limits.last_reply_at<clock_timestamp()-interval '3 seconds' RETURNING user_id`
	}
	var granted string
	err := tx.QueryRowContext(ctx, query, userID).Scan(&granted)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ErrRateLimited
	}
	return err
}
func (r *Postgres) CreatePost(ctx context.Context, userID, id, body string, media *domain.Attachment) (domain.Post, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Post{}, err
	}
	defer tx.Rollback()
	if _, err = lockActor(ctx, tx, userID); err != nil {
		return domain.Post{}, err
	}
	if err = consumeWriteSlot(ctx, tx, userID, false); err != nil {
		return domain.Post{}, err
	}
	attachment := domain.Attachment{}
	if media != nil {
		attachment = *media
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO social_posts(id,author_id,body,media_kind,media_mime,media_size,media_width,media_height,media_data,show_on_profile) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, id, userID, body, attachment.Kind, attachment.MIME, attachment.Size, attachment.Width, attachment.Height, attachment.Data, media != nil && attachment.OnProfile); err != nil {
		return domain.Post{}, err
	}
	out, err := getPost(ctx, tx, userID, id)
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}
func (r *Postgres) DeletePost(ctx context.Context, userID, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM social_posts WHERE id=$1 AND author_id=$2`, id, userID)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}
func (r *Postgres) SetLike(ctx context.Context, userID, id string, liked bool) (domain.Post, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Post{}, err
	}
	defer tx.Rollback()
	if _, err = lockActor(ctx, tx, userID); err != nil {
		return domain.Post{}, err
	}
	if err = lockPost(ctx, tx, userID, id); err != nil {
		return domain.Post{}, err
	}
	if liked {
		_, err = tx.ExecContext(ctx, `INSERT INTO social_likes(post_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, id, userID)
	} else {
		_, err = tx.ExecContext(ctx, `DELETE FROM social_likes WHERE post_id=$1 AND user_id=$2`, id, userID)
	}
	if err != nil {
		return domain.Post{}, err
	}
	out, err := getPost(ctx, tx, userID, id)
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}
func scanReply(row scanner) (domain.Reply, error) {
	var p domain.Reply
	err := row.Scan(&p.ID, &p.PostID, &p.Author.ID, &p.Author.FullName, &p.Author.Role, &p.Author.Verified, &p.Author.AvatarVersion, &p.Body, &p.CreatedAt, &p.Owned)
	p.CreatedAt = p.CreatedAt.UTC()
	return p, err
}
func (r *Postgres) Replies(ctx context.Context, userID, postID string, after domain.Cursor) ([]domain.Reply, error) {
	if _, err := r.GetPost(ctx, userID, postID); err != nil {
		return nil, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT r.id,r.post_id,u.id,u.full_name,u.role,u.verified,u.avatar_version,r.body,r.created_at,r.author_id=$1 FROM social_replies r JOIN users u ON u.id=r.author_id JOIN social_posts p ON p.id=r.post_id JOIN users pu ON pu.id=p.author_id WHERE r.post_id=$2 AND `+activeAuthor+` AND `+visibleToViewer+` AND pu.active AND pu.role IN ('player','club','coach') AND ($3='' OR (r.created_at,r.id)<($4::timestamptz,$3)) ORDER BY r.created_at DESC,r.id DESC LIMIT $5`, userID, postID, after.ID, after.CreatedAt, domain.PageSize+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Reply{}
	for rows.Next() {
		p, err := scanReply(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
func (r *Postgres) CreateReply(ctx context.Context, userID, postID, id, body string) (domain.Reply, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Reply{}, err
	}
	defer tx.Rollback()
	author, err := lockActor(ctx, tx, userID)
	if err != nil {
		return domain.Reply{}, err
	}
	if err = lockPost(ctx, tx, userID, postID); err != nil {
		return domain.Reply{}, err
	}
	if err = consumeWriteSlot(ctx, tx, userID, true); err != nil {
		return domain.Reply{}, err
	}
	out := domain.Reply{ID: id, PostID: postID, Author: author, Body: body, Owned: true}
	if err = tx.QueryRowContext(ctx, `INSERT INTO social_replies(id,post_id,author_id,body) VALUES($1,$2,$3,$4) RETURNING created_at`, id, postID, userID, body).Scan(&out.CreatedAt); err != nil {
		return out, err
	}
	out.CreatedAt = out.CreatedAt.UTC()
	return out, tx.Commit()
}
func (r *Postgres) DeleteReply(ctx context.Context, userID, postID, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM social_replies WHERE id=$1 AND post_id=$2 AND author_id=$3`, id, postID, userID)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// Media serves a post's file under the same visibility as the post itself.
func (r *Postgres) Media(ctx context.Context, viewerID, id string) (domain.Attachment, error) {
	var out domain.Attachment
	err := r.db.QueryRowContext(ctx, `SELECT p.media_kind,p.media_mime,p.media_size,p.media_width,p.media_height,p.media_data FROM social_posts p JOIN users u ON u.id=p.author_id WHERE p.id=$2 AND p.media_kind<>'' AND `+activeAuthor+` AND `+visibleToViewer, viewerID, id).Scan(&out.Kind, &out.MIME, &out.Size, &out.Width, &out.Height, &out.Data)
	if errors.Is(err, sql.ErrNoRows) {
		return out, domain.ErrNotFound
	}
	return out, err
}

// notifyFollow tells the followed account once per follower; unfollowing
// and following again does not repeat it.
func notifyFollow(ctx context.Context, tx *sql.Tx, followerID, profileID string) error {
	return notifications.CreateInTx(ctx, tx, notificationdomain.NewNotification{
		RecipientID: profileID,
		Kind:        notificationdomain.KindFollow,
		ActorID:     followerID,
		Title:       notificationdomain.Actor,
		Body:        "seni takip etmeye başladı.",
		ResourceID:  followerID,
		SourceKey:   "follow:" + followerID,
	})
}
func (r *Postgres) SetFollow(ctx context.Context, userID, id string, following bool) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	rows, err := tx.QueryContext(ctx, `SELECT id FROM users WHERE id IN ($1,$2) AND active AND role IN ('player','club','coach') ORDER BY id FOR UPDATE`, userID, id)
	if err != nil {
		return err
	}
	count := 0
	for rows.Next() {
		count++
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	if count != 2 {
		return domain.ErrNotFound
	}
	if following {
		// Neither side of a block can follow the other.
		var blocked bool
		if blocked, err = moderation.BlockedInTx(ctx, tx, userID, id); err != nil {
			return err
		}
		if blocked {
			return domain.ErrNotFound
		}
		var result sql.Result
		result, err = tx.ExecContext(ctx, `INSERT INTO profile_follows(profile_id,follower_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, id, userID)
		if err == nil && id != userID {
			var added int64
			if added, err = result.RowsAffected(); err == nil && added > 0 {
				err = notifyFollow(ctx, tx, userID, id)
			}
		}
	} else {
		_, err = tx.ExecContext(ctx, `DELETE FROM profile_follows WHERE profile_id=$1 AND follower_id=$2`, id, userID)
	}
	if err != nil {
		return err
	}
	return tx.Commit()
}
