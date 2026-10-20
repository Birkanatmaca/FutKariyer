package domain

import (
	"context"
	"time"
)

// Popup ads (19 Oct 2026): an image shown over the app when it opens, managed
// in the admin panel. Each format accepts exactly one image size, and the
// format is taken from the uploaded image rather than chosen by hand.
type PopupFormat struct {
	Name          string
	Width, Height int
}

var PopupFormats = []PopupFormat{
	{Name: "square", Width: 1080, Height: 1080},
	{Name: "portrait", Width: 1080, Height: 1350},
	{Name: "story", Width: 1080, Height: 1920},
}

// PopupFormatFor names the format whose size matches the image exactly.
func PopupFormatFor(width, height int) (string, bool) {
	for _, format := range PopupFormats {
		if format.Width == width && format.Height == height {
			return format.Name, true
		}
	}
	return "", false
}

// The admin's limits: minutes between two showings to the same account, and
// how many times one account sees the popup at most.
const (
	MinPopupInterval = 1
	MaxPopupInterval = 43200
	MinPopupViews    = 1
	MaxPopupViews    = 100
)

type Popup struct {
	ID              string `json:"id"`
	Title           string `json:"title"`
	ImageID         string `json:"imageId"`
	Format          string `json:"format"`
	Active          bool   `json:"active"`
	IntervalMinutes int    `json:"intervalMinutes"`
	MaxViews        int    `json:"maxViews"`
	// Views counts every showing, Viewers the accounts it reached.
	Views     int       `json:"views"`
	Viewers   int       `json:"viewers"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ShownPopup is all the app receives: enough to draw the popup.
type ShownPopup struct {
	ID      string `json:"id"`
	ImageID string `json:"imageId"`
	Format  string `json:"format"`
}

type PopupRepository interface {
	Popups(ctx context.Context, page int) (Page[Popup], error)
	SavePopup(ctx context.Context, in Popup, create bool) (Popup, error)
	DeletePopup(ctx context.Context, id string) error
	// NextPopup is the newest active popup this account may see now.
	NextPopup(ctx context.Context, userID string) (ShownPopup, bool, error)
	// RecordPopupView counts a showing; one outside the interval or past the
	// cap is ignored, so retries never count twice.
	RecordPopupView(ctx context.Context, popupID, userID string) error
}
