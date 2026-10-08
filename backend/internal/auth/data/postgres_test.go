package data_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"futcareer/backend/internal/auth/data"
	"futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func TestRegistrationRollsBackIfSessionCannotBeStored(t *testing.T) {
	database := testpostgres.New(t)
	repo := data.New(database.DB)
	ctx := context.Background()
	user := domain.User{
		ID: "transaction-user", FullName: "Deniz Yılmaz", Email: "deniz@example.com",
		PasswordHash: "hash", Role: "player", City: "Ankara", CreatedAt: time.Now(),
	}
	session := domain.Session{TokenHash: "session-hash", UserID: "missing-user", ExpiresAt: time.Now().Add(time.Hour)}
	if err := repo.Register(ctx, user, session); err == nil {
		t.Fatal("registration succeeded with an invalid session foreign key")
	}
	if _, err := repo.UserByID(ctx, user.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("account survived a failed registration transaction: %v", err)
	}
	session.UserID = user.ID
	if err := repo.Register(ctx, user, session); err != nil {
		t.Fatal(err)
	}
	user.Email = "different@example.com"
	if err := repo.Register(ctx, user, session); err == nil || errors.Is(err, domain.ErrEmailExists) {
		t.Fatalf("primary key collision was misidentified as a duplicate email: %v", err)
	}
}
