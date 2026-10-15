package domain

import (
	"context"
	"errors"
	"time"
)

var ErrNotFound = errors.New("player profile not found")

type Profile struct {
	UserID          string
	Position        string
	DominantFoot    string
	ExperienceYears int
	CurrentClub     string
	Availability    string
	Discoverable    bool
	FootballType    string
	LicenseStatus   string
	UpdatedAt       time.Time
}

type Repository interface {
	ProfileByUserID(context.Context, string) (Profile, error)
	SaveProfile(context.Context, Profile) error
}
