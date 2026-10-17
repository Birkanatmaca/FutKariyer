package data_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"
	"time"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/rating/application"
	"futcareer/backend/internal/rating/data"
	"futcareer/backend/internal/rating/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func member(t *testing.T, db *sql.DB, n int, name, role string) string {
	t.Helper()
	id := fmt.Sprintf("%032x", n)
	_, err := db.Exec(`INSERT INTO users(id,full_name,email,password_hash,role,city,created_at) VALUES($1,$2,$3,'hash',$4,'Ankara',now())`, id, name, id+"@example.com", role)
	if err != nil {
		t.Fatal(err)
	}
	if role == "club" {
		if _, err = db.Exec(`INSERT INTO clubs(user_id,updated_at) VALUES($1,now())`, id); err != nil {
			t.Fatal(err)
		}
	}
	return id
}

func award(t *testing.T, db *sql.DB, user, ref string, points int) {
	t.Helper()
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	if _, err = data.AwardInTx(context.Background(), tx, user, domain.SourceFootballGuess, ref, points, time.Now()); err != nil {
		t.Fatal(err)
	}
	if err = tx.Commit(); err != nil {
		t.Fatal(err)
	}
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestSeasonsLeaderboardAndTasks(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	svc := application.New(data.New(db))
	ali := member(t, db, 1, "Ali Yılmaz", "player")
	veli := member(t, db, 2, "Veli Spor", "club")
	can := member(t, db, 3, "Can Hoca", "coach")

	empty, err := svc.Board(ctx, ali)
	if err != nil || empty.Season != nil || len(empty.Top) != 0 {
		t.Fatalf("no season board: %+v %v", empty, err)
	}
	award(t, db, ali, "before-season", 1)

	now := time.Now().UTC()
	in := application.SeasonInput{
		Title: "Ekim Sezonu", StartsAt: now.Add(-time.Hour), EndsAt: now.Add(30 * 24 * time.Hour), Published: true,
		Prizes: []domain.Prize{{Place: 1, Title: "Forma"}, {Place: 2, Title: "Top"}, {Place: 3, Title: "Atkı"}},
	}
	bad := in
	bad.EndsAt = bad.StartsAt
	var fields auth.ValidationError
	if _, err = svc.CreateSeason(ctx, bad); !errors.As(err, &fields) {
		t.Fatal("season ending before it starts accepted")
	}
	season, err := svc.CreateSeason(ctx, in)
	if err != nil || season.Status(time.Now()) != "active" || len(season.Prizes) != 3 {
		t.Fatalf("create season: %+v %v", season, err)
	}
	overlap := in
	overlap.Title = "Çakışan"
	if _, err = svc.CreateSeason(ctx, overlap); !errors.Is(err, domain.ErrOverlap) {
		t.Fatalf("overlapping published season accepted: %v", err)
	}
	overlap.Published = false
	draft, err := svc.CreateSeason(ctx, overlap)
	if err != nil {
		t.Fatal("drafts may overlap")
	}

	// Ties go to whoever reached the total first; a retried ref counts once.
	award(t, db, veli, "a", 2)
	award(t, db, ali, "a", 1)
	award(t, db, ali, "b", 1)
	award(t, db, ali, "b", 1)
	award(t, db, can, "a", 1)
	board, err := svc.Board(ctx, ali)
	if err != nil || len(board.Top) != 3 {
		t.Fatalf("board: %+v %v", board, err)
	}
	if board.Top[0].UserID != veli || board.Top[1].UserID != ali || board.Top[0].Points != 2 || board.Top[1].Points != 2 || board.Top[2].UserID != can {
		t.Fatalf("ranking: %+v", board.Top)
	}
	if board.Me == nil || board.Me.Rank != 2 || board.Me.Points != 2 {
		t.Fatalf("me: %+v", board.Me)
	}

	// Tasks: inactive ones are hidden; a claim needs the goal and counts once.
	if _, err = svc.UpdateTask(ctx, domain.TaskSharePost, application.TaskInput{Active: true, Target: 1, Points: 5}); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.UpdateTask(ctx, domain.TaskSharePost, application.TaskInput{Active: true, Target: 0, Points: 5}); !errors.As(err, &fields) {
		t.Fatal("zero target accepted")
	}
	board, _ = svc.Board(ctx, ali)
	if len(board.Tasks) != 1 || board.Tasks[0].Kind != domain.TaskSharePost || board.Tasks[0].Progress != 0 {
		t.Fatalf("tasks: %+v", board.Tasks)
	}
	if _, err = svc.ClaimTask(ctx, ali, domain.TaskSharePost); !errors.Is(err, domain.ErrTaskIncomplete) {
		t.Fatalf("incomplete task claimed: %v", err)
	}
	if _, err = svc.ClaimTask(ctx, ali, domain.TaskPlayGames); !errors.Is(err, domain.ErrTaskInactive) {
		t.Fatalf("inactive task claimed: %v", err)
	}
	if _, err = db.Exec(`INSERT INTO social_posts(id,author_id,body,created_at) VALUES($1,$2,'Merhaba',now())`, fmt.Sprintf("%032x", 77), ali); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		board, err = svc.ClaimTask(ctx, ali, domain.TaskSharePost)
		if err != nil || !board.Tasks[0].Claimed || board.Me.Points != 7 || board.Me.Rank != 1 {
			t.Fatalf("claim %d: %+v %+v %v", i, board.Tasks, board.Me, err)
		}
	}

	// Admin: published seasons can't be deleted; drafts can.
	if err = svc.DeleteSeason(ctx, season.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatal("published season deleted")
	}
	if err = svc.DeleteSeason(ctx, draft.ID); err != nil {
		t.Fatal(err)
	}
	_, top, err := svc.SeasonBoard(ctx, season.ID)
	if err != nil || len(top) != 3 || top[0].UserID != ali {
		t.Fatalf("admin board: %+v %v", top, err)
	}

	// After the season ends the board keeps showing its winners.
	if _, err = db.Exec(`UPDATE rating_seasons SET starts_at=now()-interval '40 days', ends_at=now()-interval '1 minute' WHERE id=$1`, season.ID); err != nil {
		t.Fatal(err)
	}
	board, err = svc.Board(ctx, can)
	if err != nil || board.Season == nil || board.Season.Status(board.ServerTime) != "finished" || board.Top[0].UserID != ali || board.Me.Rank != 3 {
		t.Fatalf("finished board: %+v %v", board, err)
	}
	if _, err = svc.ClaimTask(ctx, ali, domain.TaskSharePost); !errors.Is(err, domain.ErrNoSeason) {
		t.Fatal("task claimed outside a season")
	}
	award(t, db, ali, "after", 1)
	var total int
	if err = db.QueryRow(`SELECT sum(points) FROM rating_points WHERE user_id=$1`, ali).Scan(&total); err != nil || total != 7 {
		t.Fatalf("points outside a season were recorded: %d %v", total, err)
	}
}
