package application

import (
	"context"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/discovery/domain"
)

// WatchlistLimit caps one coach's İzleme listesi.
const WatchlistLimit = 200

// İzleme listesi (20 Oct 2026) is a scouting tool of verified coaches, the
// accounts that may discover players besides clubs.
func watchAllowed(viewer domain.Viewer) error {
	if viewer.Role != "coach" {
		return domain.ErrForbidden
	}
	if !viewer.Verified {
		return domain.ErrVerificationRequired
	}
	return nil
}

func (s *Service) Watchlist(ctx context.Context, viewer domain.Viewer) ([]Profile, error) {
	if err := watchAllowed(viewer); err != nil {
		return nil, err
	}
	items, err := s.repo.Watchlist(ctx, viewer.ID)
	if err != nil {
		return nil, err
	}
	out := make([]Profile, 0, len(items))
	for _, item := range items {
		out = append(out, dto(item))
	}
	return out, nil
}

func (s *Service) Watch(ctx context.Context, viewer domain.Viewer, playerID string, on bool) error {
	if err := watchAllowed(viewer); err != nil {
		return err
	}
	if len(playerID) != 32 || playerID == viewer.ID {
		return domain.ErrNotFound
	}
	if on {
		count, err := s.repo.WatchCount(ctx, viewer.ID)
		if err != nil {
			return err
		}
		if count >= WatchlistLimit {
			return auth.ValidationError{"watchlist": "İzleme listen en fazla 200 oyuncu alabilir. Önce birini çıkar."}
		}
	}
	return s.repo.Watch(ctx, viewer.ID, playerID, on)
}
