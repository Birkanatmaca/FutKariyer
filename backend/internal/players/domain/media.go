package domain

import (
	"context"
	"errors"
	"time"

	"futcareer/backend/internal/platform/media"
)

// Per-athlete gallery limits; uploads beyond them are refused.
const (
	MaxPhotos = 30
	MaxVideos = 10
)

var (
	ErrMediaNotFound = errors.New("player media not found")
	ErrMediaLimit    = errors.New("player media limit reached")
	ErrMediaInvalid  = errors.New("invalid player media")
)

// MediaItem is gallery metadata; the bytes are served separately.
type MediaItem struct {
	ID        string    `json:"id"`
	OwnerID   string    `json:"ownerId"`
	Kind      string    `json:"kind"`
	MIME      string    `json:"mime"`
	Size      int       `json:"size"`
	Width     int       `json:"width"`
	Height    int       `json:"height"`
	CreatedAt time.Time `json:"createdAt"`
}

type MediaRepository interface {
	// VisibleMedia lists a player's gallery for the viewer; ErrMediaNotFound
	// when the owner is not a visible player for that viewer.
	VisibleMedia(ctx context.Context, viewerID, ownerID string) ([]MediaItem, error)
	AddMedia(ctx context.Context, ownerID, id string, file media.File) (MediaItem, error)
	DeleteMedia(ctx context.Context, ownerID, id string) error
	MediaFile(ctx context.Context, viewerID, ownerID, id string) (MediaItem, []byte, error)
}
