// Package application installs and removes the optional demo environment.
package application

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/demo/domain"
)

type Repository interface {
	Install(ctx context.Context, ds domain.Dataset, passwordHash, followEmail string) (domain.FollowResult, error)
	Remove(ctx context.Context) (int, error)
	Counts(ctx context.Context) (domain.Counts, error)
}

type Service struct {
	repo Repository
	now  func() time.Time
}

func New(repo Repository) *Service { return &Service{repo: repo, now: time.Now} }

// WithClock fixes the clock the dataset is built against (tests).
func (s *Service) WithClock(now func() time.Time) *Service { s.now = now; return s }

// Result is what an operator needs after an install. The password is never stored in plain text.
type Result struct {
	Password string
	Accounts []domain.Account
	Follow   domain.FollowResult
	Counts   domain.Counts
}

// Install replaces any demo data with a fresh copy; every account gets the same newly generated password.
func (s *Service) Install(ctx context.Context, followEmail string) (Result, error) {
	if followEmail != "" && domain.IsDemoEmail(followEmail) {
		return Result{}, domain.ErrFollowTarget
	}
	password, err := newPassword()
	if err != nil {
		return Result{}, err
	}
	ds := domain.Build(s.now())
	for _, a := range ds.Accounts {
		in := auth.AccountInput{FullName: a.FullName, Email: a.Email, Username: a.Username, Password: password, Role: a.Role}
		if _, fields := auth.ValidateAccount(in); len(fields) > 0 {
			return Result{}, fmt.Errorf("demo account %s is invalid: %v", a.Key, map[string]string(fields))
		}
	}
	hash, err := auth.PasswordHash(password)
	if err != nil {
		return Result{}, err
	}
	follow, err := s.repo.Install(ctx, ds, hash, followEmail)
	if err != nil {
		return Result{}, err
	}
	counts, err := s.repo.Counts(ctx)
	if err != nil {
		return Result{}, err
	}
	return Result{Password: password, Accounts: ds.Accounts, Follow: follow, Counts: counts}, nil
}

func (s *Service) Remove(ctx context.Context) (int, error) { return s.repo.Remove(ctx) }

func (s *Service) Counts(ctx context.Context) (domain.Counts, error) { return s.repo.Counts(ctx) }

// newPassword returns 24 URL-safe characters (144 random bits).
func newPassword() (string, error) {
	buf := make([]byte, 18)
	if _, err := rand.Read(buf); err != nil {
		return "", errors.New("random password could not be generated")
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
