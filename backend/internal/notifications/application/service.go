package application

import (
	"context"
	"regexp"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/notifications/domain"
)

var notificationIDPattern = regexp.MustCompile(`^[a-f0-9]{32}$`)

type Service struct{ repo domain.Repository }

func New(repo domain.Repository) *Service { return &Service{repo: repo} }

func (s *Service) List(ctx context.Context, userID string, page, pageSize int) (domain.Page, error) {
	if page < 1 || page > 1000000 || pageSize < 1 || pageSize > 50 {
		return domain.Page{}, auth.ValidationError{"pagination": "Sayfa 1–1000000 ve sayfa boyutu 1–50 arasında olmalı."}
	}
	return s.repo.List(ctx, userID, page, pageSize)
}

func (s *Service) UnreadCount(ctx context.Context, userID string) (int, error) {
	return s.repo.UnreadCount(ctx, userID)
}

func (s *Service) MarkRead(ctx context.Context, userID, notificationID string) error {
	if !notificationIDPattern.MatchString(notificationID) {
		return domain.ErrNotFound
	}
	return s.repo.MarkRead(ctx, userID, notificationID)
}

func (s *Service) MarkAllRead(ctx context.Context, userID string) error {
	return s.repo.MarkAllRead(ctx, userID)
}
