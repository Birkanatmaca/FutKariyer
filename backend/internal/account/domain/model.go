// Package domain holds the account profile (19 Oct 2026): personal details and
// the profile photo every mobile account can edit.
package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrForbidden     = errors.New("account profile access denied")
	ErrNotFound      = errors.New("account or avatar not found")
	ErrUsernameTaken = errors.New("username already taken")
)

type Profile struct {
	ID            string
	Role          string
	FullName      string
	Username      string
	Email         string
	City          string
	District      string
	BirthDate     *time.Time
	Bio           string
	HeightCm      *int
	WeightKg      *int
	AvatarVersion int
}

type Avatar struct {
	MIME      string
	Data      []byte
	UpdatedAt time.Time
}

type Repository interface {
	Profile(ctx context.Context, userID string) (Profile, error)
	SaveProfile(ctx context.Context, p Profile) (Profile, error)
	SetAvatar(ctx context.Context, userID, mime string, data []byte) (Profile, error)
	DeleteAvatar(ctx context.Context, userID string) (Profile, error)
	Avatar(ctx context.Context, userID string) (Avatar, error)
}
