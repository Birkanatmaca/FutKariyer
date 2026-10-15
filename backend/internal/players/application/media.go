package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"regexp"

	"futcareer/backend/internal/platform/media"
	"futcareer/backend/internal/players/domain"
)

var mediaIDPattern = regexp.MustCompile(`^[a-f0-9]{32}$`)

// MediaService manages the athlete's profile gallery.
type MediaService struct{ repo domain.MediaRepository }

func NewMedia(repo domain.MediaRepository) *MediaService { return &MediaService{repo: repo} }

func (s *MediaService) List(ctx context.Context, viewerID, ownerID string) ([]domain.MediaItem, error) {
	if !mediaIDPattern.MatchString(ownerID) {
		return nil, domain.ErrMediaNotFound
	}
	return s.repo.VisibleMedia(ctx, viewerID, ownerID)
}

func (s *MediaService) Upload(ctx context.Context, ownerID string, data []byte) (domain.MediaItem, error) {
	file, err := media.Validate(data)
	if err != nil {
		return domain.MediaItem{}, domain.ErrMediaInvalid
	}
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return domain.MediaItem{}, err
	}
	return s.repo.AddMedia(ctx, ownerID, hex.EncodeToString(value), *file)
}

func (s *MediaService) Delete(ctx context.Context, ownerID, id string) error {
	if !mediaIDPattern.MatchString(id) {
		return domain.ErrMediaNotFound
	}
	return s.repo.DeleteMedia(ctx, ownerID, id)
}

func (s *MediaService) File(ctx context.Context, viewerID, ownerID, id string) (domain.MediaItem, []byte, error) {
	if !mediaIDPattern.MatchString(ownerID) || !mediaIDPattern.MatchString(id) {
		return domain.MediaItem{}, nil, domain.ErrMediaNotFound
	}
	return s.repo.MediaFile(ctx, viewerID, ownerID, id)
}
