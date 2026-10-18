package data_test

import (
	"context"
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
