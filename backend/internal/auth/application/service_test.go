package application_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/auth/data"
	"futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func TestPersistentAuthLifecycle(t *testing.T) {
	database := testpostgres.New(t)
	repo := data.New(database.DB)
	service := application.New(repo, time.Hour)
	ctx := context.Background()
	input := application.RegisterInput{FullName: "Deniz Yılmaz", Email: " DENIZ@example.com ", Password: "strong-password-123", Role: "player"}
	registered, err := service.Register(ctx, input)
	if err != nil {
		t.Fatal(err)
	}
	if registered.User.Email != "deniz@example.com" || registered.User.City != "Ankara" {
		t.Fatal("canonical account data missing")
	}
	stored, err := repo.UserByEmail(ctx, "deniz@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if stored.PasswordHash == input.Password {
		t.Fatal("password persisted without hashing")
	}
	if _, err = service.Register(ctx, input); !errors.Is(err, domain.ErrEmailExists) {
		t.Fatalf("duplicate account: %v", err)
	}
	if _, err = service.Login(ctx, application.LoginInput{Email: input.Email, Password: "wrong-password"}); !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatal("wrong password accepted")
	}
	loggedIn, err := service.Login(ctx, application.LoginInput{Email: input.Email, Password: input.Password})
	if err != nil {
		t.Fatal(err)
	}
	if loggedIn.Token == registered.Token {
		t.Fatal("session tokens must be unique")
	}
	// Re-open the repository to prove accounts and sessions survive process restarts.
	database.Reconnect(t)
	repo = data.New(database.DB)
	service = application.New(repo, time.Hour)
	if user, err := service.Me(ctx, loggedIn.Token); err != nil || user.ID != registered.User.ID {
		t.Fatalf("persistent session: %v", err)
	}
	if err = service.Logout(ctx, loggedIn.Token); err != nil {
		t.Fatal(err)
	}
	if _, err = service.Me(ctx, loggedIn.Token); !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatal("revoked session accepted")
	}
	expired := domain.Session{Audience: "mobile", TokenHash: application.HashToken(registered.Token), UserID: registered.User.ID, ExpiresAt: time.Now().Add(-time.Hour)}
	if err = repo.DeleteSession(ctx, expired.TokenHash); err != nil {
		t.Fatal(err)
	}
	if err = repo.CreateSession(ctx, expired); err != nil {
		t.Fatal(err)
	}
	if _, err = service.Me(ctx, registered.Token); !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatal("expired session accepted")
	}
}
func TestRegistrationRejectsInvalidAccounts(t *testing.T) {
	service := application.New(nil, time.Hour)
	_, err := service.Register(context.Background(), application.RegisterInput{FullName: "X", Email: "invalid", Password: "short", Role: "admin"})
	var fields application.ValidationError
	if !errors.As(err, &fields) || len(fields) != 4 {
		t.Fatalf("invalid account was not fully rejected: %v", err)
	}
}
