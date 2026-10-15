package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"regexp"

	"futcareer/backend/internal/pro/domain"
)

var idPattern = regexp.MustCompile(`^[a-f0-9]{32}$`)

type Service struct{ repo domain.Repository }

func New(repo domain.Repository) *Service { return &Service{repo: repo} }

// Viewer is the authenticated mobile account; its role is re-read from the session on every request.
type Viewer struct {
	ID   string
	Role string
}

func (s *Service) Status(ctx context.Context, viewer Viewer) (domain.Status, error) {
	if !domain.EligibleRole(viewer.Role) {
		return domain.Status{}, nil
	}
	return s.repo.Status(ctx, viewer.ID)
}

func (s *Service) SetPrivateBrowsing(ctx context.Context, viewer Viewer, on bool) (domain.Status, error) {
	if !domain.EligibleRole(viewer.Role) {
		return domain.Status{}, domain.ErrProRequired
	}
	return s.repo.SetPrivateBrowsing(ctx, viewer.ID, on)
}

// AdminStatus, Grant and Revoke are called from administrator routes only.
func (s *Service) AdminStatus(ctx context.Context, userID string) (domain.Status, error) {
	if !idPattern.MatchString(userID) {
		return domain.Status{}, domain.ErrNotFound
	}
	return s.repo.Status(ctx, userID)
}

func (s *Service) Grant(ctx context.Context, userID string) (domain.Status, error) {
	if !idPattern.MatchString(userID) {
		return domain.Status{}, domain.ErrNotFound
	}
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return domain.Status{}, err
	}
	return s.repo.Grant(ctx, userID, hex.EncodeToString(value))
}

func (s *Service) Revoke(ctx context.Context, userID string) (domain.Status, error) {
	if !idPattern.MatchString(userID) {
		return domain.Status{}, domain.ErrNotFound
	}
	return s.repo.Revoke(ctx, userID)
}
