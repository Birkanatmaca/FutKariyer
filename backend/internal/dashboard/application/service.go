package application

import (
	"context"
	"slices"
	"time"

	"futcareer/backend/internal/dashboard/domain"
)

type Service struct {
	repo domain.Repository
	now  func() time.Time
}

func New(repo domain.Repository) *Service { return &Service{repo: repo, now: time.Now} }

// Dashboard summarises the last days (7, 30 or 90; default 30) and the
// equal window before them.
func (s *Service) Dashboard(ctx context.Context, days int) (domain.Dashboard, error) {
	if !slices.Contains(domain.Windows, days) {
		days = 30
	}
	now := s.now()
	since := now.AddDate(0, 0, -days+1).Truncate(time.Hour)
	return s.repo.Dashboard(ctx, domain.Query{Days: days, Now: now, Since: since, Prev: since.AddDate(0, 0, -days)})
}
