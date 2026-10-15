package data_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"

	auth "futcareer/backend/internal/auth/application"
	clubapp "futcareer/backend/internal/clubs/application"
	clubdata "futcareer/backend/internal/clubs/data"
	"futcareer/backend/internal/content/application"
	"futcareer/backend/internal/content/data"
	"futcareer/backend/internal/content/domain"
	leagueapp "futcareer/backend/internal/leagues/application"
	leaguedata "futcareer/backend/internal/leagues/data"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func club(t *testing.T, db *sql.DB, n int) string {
	t.Helper()
	id := fmt.Sprintf("%032x", n)
	if _, err := db.Exec(`INSERT INTO users(id,full_name,email,password_hash,role,city,created_at,adult_confirmed,active) VALUES($1,'Kulüp QA',$2,'hash','club','Ankara',now(),true,true)`, id, id+"@example.com"); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO clubs(user_id,updated_at) VALUES($1,now())`, id); err != nil {
		t.Fatal(err)
	}
	return id
}

func visible(t *testing.T, svc *application.Service) []domain.Article {
	t.Helper()
	page, err := svc.News(context.Background(), false, false, 1)
	if err != nil {
		t.Fatal(err)
	}
	return page.Items
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestClubNewsNeedsApprovalAndNotifiesAuthor(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	svc := application.New(data.New(db))
	author := club(t, db, 601)

	article, err := svc.SubmitClubArticle(ctx, author, domain.Article{Title: "Kulüp haberi", Summary: "Yeni sezon", Body: "Antrenmanlar başladı."})
	if err != nil || article.ReviewStatus != "pending" || article.Published || article.AuthorName != "Kulüp QA" {
		t.Fatalf("submit: %+v %v", article, err)
	}
	if len(visible(t, svc)) != 0 {
		t.Fatal("pending club article visible to the public")
	}
	queue, err := svc.PendingClubArticles(ctx)
	if err != nil || len(queue) != 1 {
		t.Fatalf("review queue: %d %v", len(queue), err)
	}
	mine, err := svc.ClubArticles(ctx, author)
	if err != nil || len(mine) != 1 {
		t.Fatalf("club sees its own pending article: %d %v", len(mine), err)
	}

	if _, err := svc.ReviewClubArticle(ctx, article.ID, "maybe"); !errors.As(err, new(auth.ValidationError)) {
		t.Fatal("unknown decision accepted")
	}
	approved, err := svc.ReviewClubArticle(ctx, article.ID, "approve")
	if err != nil || !approved.Published || approved.ReviewStatus != "approved" {
		t.Fatalf("approve: %+v %v", approved, err)
	}
	if len(visible(t, svc)) != 1 {
		t.Fatal("approved article not visible to other accounts")
	}
	var notes int
	if err := db.QueryRow(`SELECT count(*) FROM notifications WHERE recipient_id=$1 AND kind='news_review'`, author).Scan(&notes); err != nil || notes != 1 {
		t.Fatalf("author should get one review notification, got %d %v", notes, err)
	}
	if _, err := svc.ReviewClubArticle(ctx, article.ID, "reject"); err == nil {
		t.Fatal("reviewed article reviewed again")
	}

	// Admin edits cannot publish a club article that has not been approved.
	second, _ := svc.SubmitClubArticle(ctx, author, domain.Article{Title: "İkinci haber", Summary: "Özet", Body: "Metin metin"})
	forced, err := svc.SaveArticle(ctx, domain.Article{ID: second.ID, Title: "İkinci haber", Summary: "Özet", Body: "Metin metin", Published: true}, false)
	if err != nil || forced.Published || forced.ReviewStatus != "pending" {
		t.Fatalf("admin edit published an unapproved club article: %+v %v", forced, err)
	}
	rejected, err := svc.ReviewClubArticle(ctx, second.ID, "reject")
	if err != nil || rejected.Published || rejected.ReviewStatus != "rejected" {
		t.Fatalf("reject: %+v %v", rejected, err)
	}
	if err := db.QueryRow(`SELECT count(*) FROM notifications WHERE recipient_id=$1 AND kind='news_review'`, author).Scan(&notes); err != nil || notes != 2 {
		t.Fatal("rejection did not notify the author")
	}
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestClubProfileEditsOnlyClubFields(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	svc := clubapp.New(clubdata.New(db), leagueapp.New(leaguedata.New(db)))
	id := club(t, db, 602)
	if _, err := db.Exec(`UPDATE clubs SET football_type='amateur' WHERE user_id=$1`, id); err != nil {
		t.Fatal(err)
	}
	profile, err := svc.UpdateProfile(ctx, id, clubapp.ProfileInput{District: "Çankaya", Description: "Ankara'nın genç takımı", VenueName: "Halı saha", TrainingSchedule: "Salı-Perşembe 19:00"})
	if err != nil || profile.District != "Çankaya" || profile.FootballType != "amateur" || profile.Name != "Kulüp QA" {
		t.Fatalf("profile update: %+v %v", profile, err)
	}
	_, err = svc.UpdateProfile(ctx, id, clubapp.ProfileInput{District: string(make([]byte, 81))})
	if !errors.As(err, new(auth.ValidationError)) {
		t.Fatal("oversized district accepted")
	}
}
