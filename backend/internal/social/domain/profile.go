package domain

import "context"

// Profile is an author's social profile, opened from a post's name or photo
// (22 Oct 2026). It carries only what the author's posts already show plus
// public counts; football details stay behind the discovery rules.
type Profile struct {
	Author
	Posts          int  `json:"posts"`
	Followers      int  `json:"followers"`
	FollowingCount int  `json:"followingCount"`
	Self           bool `json:"self"`
	// Discovery is whether the viewer may also open the author's discovery
	// profile (football card, gallery, introduction request).
	Discovery bool `json:"discovery"`
}

// ProfileReader is implemented by the PostgreSQL repository. Opening another
// author's profile records a profile view for the author's Ziyaretçiler.
type ProfileReader interface {
	Profile(ctx context.Context, viewerID, userID string) (Profile, error)
}
