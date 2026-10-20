package data_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"futcareer/backend/internal/social/data"
	"futcareer/backend/internal/social/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

const (
	viewerID = "00000000000000000000000000000a01"
	authorID = "00000000000000000000000000000a02"
)

func TestExploreSnapshotAndFollowingFeed(t *testing.T) {
	db := testpostgres.New(t)
	ctx := context.Background()
	for _, id := range []string{viewerID, authorID} {
		if _, err := db.DB.ExecContext(ctx, `INSERT INTO users(id,full_name,email,password_hash,role,city,created_at) VALUES($1,$1,$1||'@example.test','unused','player','Ankara',now())`, id); err != nil {
			t.Fatal(err)
		}
	}
	repo := data.New(db.DB)
	snapshot := domain.FeedCursor{SnapshotAt: time.Now().UTC()}
	if posts, err := repo.Feed(ctx, viewerID, snapshot, false); err != nil || len(posts) != 0 {
		t.Fatalf("empty explore feed: %v %v", posts, err)
	}
	post, err := repo.CreatePost(ctx, authorID, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "Football", nil)
	if err != nil {
		t.Fatal(err)
	}
	if posts, err := repo.Feed(ctx, viewerID, snapshot, false); err != nil || len(posts) != 0 {
		t.Fatalf("new post escaped snapshot: %v %v", posts, err)
	}
	snapshot.SnapshotAt = post.CreatedAt.Add(time.Second)
	if posts, err := repo.Feed(ctx, viewerID, snapshot, false); err != nil || len(posts) != 1 || posts[0].ID != "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" {
		t.Fatalf("explore feed: %v %v", posts, err)
	}
	if posts, err := repo.Feed(ctx, viewerID, snapshot, true); err != nil || len(posts) != 0 {
		t.Fatalf("unfollowed author leaked: %v %v", posts, err)
	}
	if err := repo.SetFollow(ctx, viewerID, authorID, true); err != nil {
		t.Fatal(err)
	}
	if posts, err := repo.Feed(ctx, viewerID, snapshot, true); err != nil || len(posts) != 1 || !posts[0].Author.Following {
		t.Fatalf("following feed: %v %v", posts, err)
	}
	// Following notifies the followed account once, even after a refollow.
	for _, follow := range []bool{false, true} {
		if err := repo.SetFollow(ctx, viewerID, authorID, follow); err != nil {
			t.Fatal(err)
		}
	}
	var notes int
	if err := db.DB.QueryRowContext(ctx, `SELECT count(*) FROM notifications WHERE recipient_id=$1 AND kind='follow' AND resource_id=$2`, authorID, viewerID).Scan(&notes); err != nil || notes != 1 {
		t.Fatalf("follow notifications: %d %v", notes, err)
	}
}

func TestUserPostsListsAuthorPostsAndProfileMedia(t *testing.T) {
	db := testpostgres.New(t)
	ctx := context.Background()
	for _, id := range []string{viewerID, authorID} {
		if _, err := db.DB.ExecContext(ctx, `INSERT INTO users(id,full_name,email,password_hash,role,city,created_at) VALUES($1,$1,$1||'@example.test','unused','player','Ankara',now())`, id); err != nil {
			t.Fatal(err)
		}
	}
	repo := data.New(db.DB)
	image := func(onProfile bool) *domain.Attachment {
		return &domain.Attachment{Media: domain.Media{Kind: "image", MIME: "image/png", Size: 3, Width: 1, Height: 1}, Data: []byte{1, 2, 3}, OnProfile: onProfile}
	}
	// Posts are rate limited to one per five seconds per author.
	post := func(id, body string, media *domain.Attachment) {
		if _, err := db.DB.ExecContext(ctx, `DELETE FROM social_write_limits`); err != nil {
			t.Fatal(err)
		}
		if _, err := repo.CreatePost(ctx, authorID, id, body, media); err != nil {
			t.Fatal(err)
		}
	}
	post("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1", "Sadece metin", nil)
	post("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2", "Profilde", image(true))
	post("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa3", "Gizli", image(false))

	all, err := repo.UserPosts(ctx, viewerID, authorID, domain.Cursor{}, false)
	if err != nil || len(all) != 3 {
		t.Fatalf("all posts: %d %v", len(all), err)
	}
	media, err := repo.UserPosts(ctx, viewerID, authorID, domain.Cursor{}, true)
	if err != nil || len(media) != 1 || media[0].ID != "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2" || !media[0].ShowOnProfile {
		t.Fatalf("profile media: %+v %v", media, err)
	}
	for _, p := range all {
		if p.ID == "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1" && p.ShowOnProfile {
			t.Fatal("text-only post shown on profile")
		}
	}
	if _, err := db.DB.ExecContext(ctx, `UPDATE social_posts SET show_on_profile=true WHERE id='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1'`); err == nil {
		t.Fatal("text-only post accepted show_on_profile")
	}
}

// A block either way closes every social path between the two accounts:
// likes, replies, follows and the post's media file (20 Oct 2026).
func TestBlockClosesLikesRepliesFollowsAndMedia(t *testing.T) {
	db := testpostgres.New(t)
	ctx := context.Background()
	for _, id := range []string{viewerID, authorID} {
		if _, err := db.DB.ExecContext(ctx, `INSERT INTO users(id,full_name,email,password_hash,role,city,created_at) VALUES($1,$1,$1||'@example.test','unused','player','Ankara',now())`, id); err != nil {
			t.Fatal(err)
		}
	}
	repo := data.New(db.DB)
	const postID = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	photo := &domain.Attachment{Media: domain.Media{Kind: "image", MIME: "image/png", Size: 3, Width: 1, Height: 1}, Data: []byte("png")}
	if _, err := repo.CreatePost(ctx, authorID, postID, "Antrenman", photo); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.Media(ctx, viewerID, postID); err != nil {
		t.Fatalf("media before block: %v", err)
	}
	// Both directions: the author blocks the viewer, then the viewer blocks the author.
	for _, block := range [][2]string{{authorID, viewerID}, {viewerID, authorID}} {
		if _, err := db.DB.ExecContext(ctx, `DELETE FROM user_blocks`); err != nil {
			t.Fatal(err)
		}
		if _, err := db.DB.ExecContext(ctx, `INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, block[0], block[1]); err != nil {
			t.Fatal(err)
		}
		if _, err := repo.SetLike(ctx, viewerID, postID, true); !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("like across a block: %v", err)
		}
		if _, err := repo.CreateReply(ctx, viewerID, postID, "cccccccccccccccccccccccccccccccc", "Selam"); !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("reply across a block: %v", err)
		}
		if err := repo.SetFollow(ctx, viewerID, authorID, true); !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("follow across a block: %v", err)
		}
		if _, err := repo.Media(ctx, viewerID, postID); !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("media across a block: %v", err)
		}
		if _, err := repo.Media(ctx, authorID, postID); err != nil {
			t.Fatalf("author lost their own media: %v", err)
		}
	}
	var leaked int
	if err := db.DB.QueryRowContext(ctx, `SELECT (SELECT count(*) FROM social_likes)+(SELECT count(*) FROM social_replies)+(SELECT count(*) FROM profile_follows)+(SELECT count(*) FROM notifications)`).Scan(&leaked); err != nil || leaked != 0 {
		t.Fatalf("rows written across a block: %d %v", leaked, err)
	}
	// Unblocking restores the paths.
	if _, err := db.DB.ExecContext(ctx, `DELETE FROM user_blocks`); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.SetLike(ctx, viewerID, postID, true); err != nil {
		t.Fatalf("like after unblock: %v", err)
	}
	if err := repo.SetFollow(ctx, viewerID, authorID, true); err != nil {
		t.Fatalf("follow after unblock: %v", err)
	}
}
