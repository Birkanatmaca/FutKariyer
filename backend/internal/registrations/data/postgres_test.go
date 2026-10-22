package data_test

import (
	"context"
	"errors"
	"testing"
	"time"

	auth "futcareer/backend/internal/auth/application"
	authdata "futcareer/backend/internal/auth/data"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/registrations/data"
	"futcareer/backend/internal/testsupport/testpostgres"
)

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestClubApplicationsNeedApproval(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	svc := auth.New(authdata.New(db), time.Hour)
	queue := data.New(db)
	club := auth.ApplyInput{Role: "club", FullName: "Gençlik FK", ContactName: "Ali Veli", Username: "genclikfk", Email: "kulup@example.com", Password: "guclu-sifre-123", Phone: "+90 555 000 00 00", District: "Çankaya", FootballType: "halisaha", Note: "Halı saha takımıyız."}
	if err := svc.Apply(ctx, club); err != nil {
		t.Fatal(err)
	}
	// Only administrators open organizer accounts (22 Oct 2026).
	if err := svc.Apply(ctx, auth.ApplyInput{Role: "organizer", FullName: "Ankara Turnuva", ContactName: "Ayşe Yılmaz", Username: "orgturnuva", Email: "org2@example.com", Password: "guclu-sifre-456"}); !errors.As(err, new(auth.ValidationError)) {
		t.Fatalf("organizer application accepted: %v", err)
	}
	second := auth.ApplyInput{Role: "club", FullName: "Ankara Turnuva", ContactName: "Ayşe Yılmaz", Username: "ankaraturnuva", Email: "org@example.com", Password: "guclu-sifre-456", FootballType: "amateur"}
	if err := svc.Apply(ctx, second); err != nil {
		t.Fatal(err)
	}
	dup := second
	dup.Email = "baska@example.com"
	if err := svc.Apply(ctx, dup); !errors.Is(err, authdomain.ErrUsernameExists) {
		t.Fatalf("duplicate username accepted: %v", err)
	}
	if err := svc.Apply(ctx, auth.ApplyInput{Role: "player", FullName: "X Y", ContactName: "X Y", Username: "xyz", Email: "x@example.com", Password: "guclu-sifre-789"}); !errors.As(err, new(auth.ValidationError)) {
		t.Fatal("player application accepted through the club/organizer form")
	}

	if _, err := svc.Login(ctx, auth.LoginInput{Identifier: "genclikfk", Password: "yanlis-sifre-000"}); !errors.Is(err, authdomain.ErrUnauthorized) {
		t.Fatalf("wrong password must not reveal the application: %v", err)
	}
	if _, err := svc.Login(ctx, auth.LoginInput{Identifier: "genclikfk", Password: club.Password}); !errors.Is(err, authdomain.ErrPendingApproval) {
		t.Fatalf("pending club signed in: %v", err)
	}

	pending, err := queue.List(ctx, "pending")
	if err != nil || len(pending) != 2 || pending[0].FullName != "Gençlik FK" || pending[0].FootballType != "halisaha" || pending[0].Phone == "" {
		t.Fatalf("pending queue: %+v %v", pending, err)
	}
	approved, err := queue.Decide(ctx, pending[0].UserID, true, "")
	if err != nil || approved.Status != "approved" || approved.DecidedAt == nil {
		t.Fatalf("approve: %+v %v", approved, err)
	}
	if _, err := queue.Decide(ctx, pending[0].UserID, false, "geç"); !errors.Is(err, data.ErrInvalidState) {
		t.Fatal("decided application decided again")
	}
	result, err := svc.Login(ctx, auth.LoginInput{Identifier: "genclikfk", Password: club.Password})
	if err != nil || !result.User.Verified || result.User.Role != "club" {
		t.Fatalf("approved club login: %+v %v", result.User, err)
	}

	rejected, err := queue.Decide(ctx, pending[1].UserID, false, "Belgeler eksik")
	if err != nil || rejected.Status != "rejected" || rejected.RejectionReason != "Belgeler eksik" {
		t.Fatalf("reject: %+v %v", rejected, err)
	}
	if _, err := svc.Login(ctx, auth.LoginInput{Identifier: "ankaraturnuva", Password: second.Password}); !errors.Is(err, authdomain.ErrApplicationRejected) {
		t.Fatalf("rejected club signed in: %v", err)
	}
}
