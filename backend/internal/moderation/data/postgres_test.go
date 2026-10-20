package data_test

import (
	"context"
	"errors"
	"testing"
	"time"

	moderation "futcareer/backend/internal/moderation/data"
	"futcareer/backend/internal/moderation/domain"
	social "futcareer/backend/internal/social/data"
	socialdomain "futcareer/backend/internal/social/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

const (
	viewer = "11111111111111111111111111111111"
	author = "22222222222222222222222222222222"
	postID = "33333333333333333333333333333333"
)

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestBlockHidesPostsBothWaysAndReportsResolve(t *testing.T) {
	db := testpostgres.New(t)
	ctx := context.Background()
	for _, id := range []string{viewer, author} {
		if _, err := db.DB.ExecContext(ctx, `INSERT INTO users(id,full_name,email,password_hash,role,city,created_at) VALUES($1,$1,$1||'@example.test','unused','player','Ankara',now())`, id); err != nil {
			t.Fatal(err)
		}
	}
	feed := social.New(db.DB)
	if _, err := feed.CreatePost(ctx, author, postID, "Football", nil); err != nil {
		t.Fatal(err)
	}
	snapshot := socialdomain.FeedCursor{SnapshotAt: time.Now().UTC().Add(time.Second)}
	repo := moderation.New(db.DB)

	target, err := repo.Target(ctx, viewer, "post", postID)
	if err != nil || target.UserID != author || target.Excerpt != "Football" {
		t.Fatalf("target: %+v %v", target, err)
	}
	if _, err := repo.Target(ctx, author, "post", postID); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("own content could be reported: %v", err)
	}
	report := domain.ReportInput{TargetKind: "post", TargetID: postID, Reason: "spam"}
	if err := repo.CreateReport(ctx, "44444444444444444444444444444444", viewer, report, target); err != nil {
		t.Fatal(err)
	}
	if err := repo.CreateReport(ctx, "55555555555555555555555555555555", viewer, report, target); !errors.Is(err, domain.ErrDuplicate) {
		t.Fatalf("duplicate report: %v", err)
	}

	if err := repo.Block(ctx, author, viewer); err != nil {
		t.Fatal(err)
	}
	// The block is mutual in effect: the blocked viewer no longer sees the blocker's posts.
	if posts, err := feed.Feed(ctx, viewer, snapshot, false); err != nil || len(posts) != 0 {
		t.Fatalf("blocked author still visible: %v %v", posts, err)
	}
	if _, err := feed.GetPost(ctx, viewer, postID); !errors.Is(err, socialdomain.ErrNotFound) {
		t.Fatalf("blocked post opened directly: %v", err)
	}
	if err := repo.Unblock(ctx, author, viewer); err != nil {
		t.Fatal(err)
	}
	if posts, err := feed.Feed(ctx, viewer, snapshot, false); err != nil || len(posts) != 1 {
		t.Fatalf("unblock did not restore the feed: %v %v", posts, err)
	}

	page, err := repo.Reports(ctx, "open", 1, 20)
	if err != nil || page.Total != 1 || page.Items[0].TargetReports != 1 {
		t.Fatalf("open reports: %+v %v", page, err)
	}
	resolved, err := repo.Resolve(ctx, page.Items[0].ID, "remove")
	if err != nil || resolved.Status != "removed" || resolved.Excerpt != "Football" {
		t.Fatalf("resolve: %+v %v", resolved, err)
	}
	if _, err := feed.GetPost(ctx, viewer, postID); !errors.Is(err, socialdomain.ErrNotFound) {
		t.Fatalf("removed post still exists: %v", err)
	}
	if _, err := repo.Resolve(ctx, page.Items[0].ID, "dismiss"); !errors.Is(err, domain.ErrAlreadyFinal) {
		t.Fatalf("a resolved report was reopened: %v", err)
	}
}

// Deleting an account removes its words from the review queue: the excerpt
// with the reported account, the note with the reporter. The report and its
// decision stay (20 Oct 2026).
func TestDeletedAccountsLeaveNoWordsInReports(t *testing.T) {
	db := testpostgres.New(t)
	ctx := context.Background()
	for _, id := range []string{viewer, author} {
		if _, err := db.DB.ExecContext(ctx, `INSERT INTO users(id,full_name,email,password_hash,role,city,created_at) VALUES($1,$1,$1||'@example.test','unused','player','Ankara',now())`, id); err != nil {
			t.Fatal(err)
		}
	}
	report := func(id, reporter, target string) {
		t.Helper()
		if _, err := db.DB.ExecContext(ctx, `INSERT INTO content_reports(id,reporter_id,target_kind,target_id,target_user_id,target_excerpt,reason,note) VALUES($1,$2,'user',$3,$3,'Kişisel metin','harassment','Bana yazdı')`, id, reporter, target); err != nil {
			t.Fatal(err)
		}
	}
	report("e0000000000000000000000000000001", viewer, author)
	report("e0000000000000000000000000000002", author, viewer)
	if _, err := db.DB.ExecContext(ctx, `DELETE FROM users WHERE id=$1`, author); err != nil {
		t.Fatal(err)
	}
	var excerpt, note string
	if err := db.DB.QueryRowContext(ctx, `SELECT target_excerpt,note FROM content_reports WHERE id='e0000000000000000000000000000001'`).Scan(&excerpt, &note); err != nil || excerpt != "" || note != "Bana yazdı" {
		t.Fatalf("report about the deleted account: %q %q %v", excerpt, note, err)
	}
	if err := db.DB.QueryRowContext(ctx, `SELECT target_excerpt,note FROM content_reports WHERE id='e0000000000000000000000000000002'`).Scan(&excerpt, &note); err != nil || note != "" || excerpt != "Kişisel metin" {
		t.Fatalf("report by the deleted account: %q %q %v", excerpt, note, err)
	}
}
