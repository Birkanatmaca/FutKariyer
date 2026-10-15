package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"

	"futcareer/backend/internal/moderation/domain"
)

type Service struct{ repo domain.Repository }

func New(repo domain.Repository) *Service { return &Service{repo: repo} }

func newID() (string, error) {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}

// Report queues a post, reply or profile for administrator review.
func (s *Service) Report(ctx context.Context, reporterID string, in domain.ReportInput) error {
	in, err := in.Normalize()
	if err != nil {
		return err
	}
	target, err := s.repo.Target(ctx, reporterID, in.TargetKind, in.TargetID)
	if err != nil {
		return err
	}
	id, err := newID()
	if err != nil {
		return err
	}
	return s.repo.CreateReport(ctx, id, reporterID, in, target)
}

func (s *Service) Reports(ctx context.Context, status string, page, pageSize int) (domain.ReportPage, error) {
	if (status != "open" && status != "resolved") || page < 1 || page > 100000 || pageSize < 1 || pageSize > 50 {
		return domain.ReportPage{}, domain.ErrInvalid
	}
	return s.repo.Reports(ctx, status, page, pageSize)
}

func (s *Service) Resolve(ctx context.Context, id, action string) (domain.Report, error) {
	if !domain.ValidID(id) || !domain.ValidAction(action) {
		return domain.Report{}, domain.ErrInvalid
	}
	return s.repo.Resolve(ctx, id, action)
}

func (s *Service) Block(ctx context.Context, blockerID, blockedID string) error {
	if !domain.ValidID(blockedID) || blockerID == blockedID {
		return domain.ErrInvalid
	}
	return s.repo.Block(ctx, blockerID, blockedID)
}

func (s *Service) Unblock(ctx context.Context, blockerID, blockedID string) error {
	if !domain.ValidID(blockedID) {
		return domain.ErrInvalid
	}
	return s.repo.Unblock(ctx, blockerID, blockedID)
}

func (s *Service) Blocks(ctx context.Context, blockerID string) ([]domain.BlockedUser, error) {
	return s.repo.Blocks(ctx, blockerID)
}
