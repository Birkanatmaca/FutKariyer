package domain

import (
	"bytes"
	"embed"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"time"
)

// Demo pictures (19 Oct 2026): stock photos under the Unsplash License for
// people and posts (assets/SOURCES.md), and drawn crests for clubs and the
// organizer. They ship only with the seed command.
//
//go:embed assets/*.jpg assets/*.png
var assets embed.FS

// Photo is a picture stored with a demo row.
type Photo struct {
	MIME          string
	Width, Height int
	Data          []byte
}

// photo loads an embedded asset. The names are fixed fixtures, so a missing
// or broken file is a programming error caught by the tests.
func photo(name string) Photo {
	data, err := assets.ReadFile("assets/" + name)
	if err != nil {
		panic(err)
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		panic(err)
	}
	return Photo{MIME: "image/" + format, Width: cfg.Width, Height: cfg.Height, Data: data}
}

// Avatar is a profile photo (people) or crest (clubs, organizer).
type Avatar struct {
	UserID string
	Photo  Photo
}

// GalleryItem is a photo in a player's profile gallery.
type GalleryItem struct {
	ID        string
	OwnerID   string
	Photo     Photo
	CreatedAt time.Time
}

// ContentImage is a news cover. Images have no owner, so removal targets
// these fixed ids (NewsImageIDs).
type ContentImage struct {
	ID    string
	Photo Photo
}

// CoachProfile is the demo coach's football details and visibility.
type CoachProfile struct {
	UserID          string
	LicenseLevel    string
	Specialties     []string
	ExperienceYears int
	FootballType    string
	Availability    string
	PastClubs       []string
	ShowLicense     bool
	ShowExperience  bool
	ShowFootball    bool
	ShowClubs       bool
	UpdatedAt       time.Time
}

// StaffLink puts the demo coach on a club's technical staff, so switching
// into the club account can be tried.
type StaffLink struct {
	ClubID      string
	CoachID     string
	Role        string
	Permissions []string
	InvitedAt   time.Time
	JoinedAt    time.Time
}

// NewsImageIDs are the cover image ids the dataset can write.
func NewsImageIDs() []string {
	ids := make([]string, 0, len(newsPhotos))
	for _, n := range newsFixtures {
		if _, ok := newsPhotos[n.key]; ok {
			ids = append(ids, newsImageID(n.key))
		}
	}
	return ids
}

func newsImageID(key string) string { return ID("image", "news/"+key) }
