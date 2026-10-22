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
	// PlayerProfile is the player's football card, present only when the
	// viewer may open their discovery profile; same fields as discovery.
	PlayerProfile *PlayerCard `json:"playerProfile"`
}

type PlayerCard struct {
	Position        string `json:"position"`
	DominantFoot    string `json:"dominantFoot"`
	ExperienceYears int    `json:"experienceYears"`
	CurrentClub     string `json:"currentClub"`
	Availability    string `json:"availability"`
	Discoverable    bool   `json:"discoverable"`
	FootballType    string `json:"footballType"`
	LicenseStatus   string `json:"licenseStatus"`
	UpdatedAt       string `json:"updatedAt"`
}

// ProfileReader is implemented by the PostgreSQL repository. Opening another
// author's profile records a profile view for the author's Ziyaretçiler.
type ProfileReader interface {
	Profile(ctx context.Context, viewerID, userID string) (Profile, error)
}
