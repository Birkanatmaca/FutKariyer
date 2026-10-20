package domain

import (
	"context"
	"errors"

	players "futcareer/backend/internal/players/domain"
)

var ErrForbidden = errors.New("discovery access denied")
var ErrVerificationRequired = errors.New("provider verification required")
var ErrNotFound = errors.New("discoverable profile not found")

type Viewer struct {
	ID       string
	Role     string
	Verified bool
}

// Profile is a public projection; credentials and contact information never enter discovery.
type Profile struct {
	ID            string
	FullName      string
	Role          string
	Verified      bool
	IsPro         bool
	District      string
	AvatarVersion int
	PlayerProfile *players.Profile
}

type Insights struct {
	ProfileViews int `json:"profileViews"`
	Followers    int `json:"followers"`
	Following    int `json:"following"`
}

type Query struct {
	ViewerID      string
	Role          string
	Search        string
	Position      string
	DominantFoot  string
	Availability  string
	FootballType  string
	LicenseStatus string
	Page          int
	PageSize      int
}

type Page struct {
	Items []Profile
	Total int
}

type Repository interface {
	List(context.Context, Query) (Page, error)
	Get(ctx context.Context, role, id, viewer string) (Profile, error)
	RecordView(context.Context, string, string, string) error
	Following(context.Context, string, string) (bool, error)
	Follow(context.Context, string, string, string, bool) error
	Insights(context.Context, string) (Insights, error)
	// Visitors returns the owner (with current Pro state) and the per-visitor aggregates of the window.
	Visitors(context.Context, string) (VisitorOwner, []Visit, error)
	// Watchlist returns the owner's starred players still visible in discovery, newest first.
	Watchlist(ctx context.Context, owner string) ([]Profile, error)
	// Watch stars (on) or unstars a player; starring needs a visible, unblocked player.
	Watch(ctx context.Context, owner, player string, on bool) error
	WatchCount(ctx context.Context, owner string) (int, error)
}
