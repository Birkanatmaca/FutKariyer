package data_test

import (
	"context"
	"testing"
	"time"

	"futcareer/backend/internal/social/data"
	"futcareer/backend/internal/social/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func TestExploreSnapshotAndFollowingFeed(t *testing.T) {
	db := testpostgres.New(t)
	ctx := context.Background()
	for _, id := range []string{"viewer", "author"} {
		if _, err := db.DB.ExecContext(ctx, `INSERT INTO users(id,full_name,email,password_hash,role,city,created_at) VALUES($1,$1,$1||'@example.test','unused','player','Ankara',now())`, id); err != nil {
			t.Fatal(err)
		}
	}
	repo := data.New(db.DB)
	snapshot := domain.FeedCursor{SnapshotAt: time.Now().UTC()}
	if posts, err := repo.Feed(ctx, "viewer", snapshot, false); err != nil || len(posts) != 0 {
		t.Fatalf("empty explore feed: %v %v", posts, err)
	}
	post, err := repo.CreatePost(ctx, "author", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "Football", nil)
	if err != nil {
		t.Fatal(err)
	}
	if posts, err := repo.Feed(ctx, "viewer", snapshot, false); err != nil || len(posts) != 0 {
		t.Fatalf("new post escaped snapshot: %v %v", posts, err)
	}
	snapshot.SnapshotAt = post.CreatedAt.Add(time.Second)
	if posts, err := repo.Feed(ctx, "viewer", snapshot, false); err != nil || len(posts) != 1 || posts[0].ID != "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" {
		t.Fatalf("explore feed: %v %v", posts, err)
	}
	if posts, err := repo.Feed(ctx, "viewer", snapshot, true); err != nil || len(posts) != 0 {
		t.Fatalf("unfollowed author leaked: %v %v", posts, err)
	}
	if err := repo.SetFollow(ctx, "viewer", "author", true); err != nil {
		t.Fatal(err)
	}
	if posts, err := repo.Feed(ctx, "viewer", snapshot, true); err != nil || len(posts) != 1 || !posts[0].Author.Following {
		t.Fatalf("following feed: %v %v", posts, err)
	}
}
