package domain

import (
	"errors"
	"time"
)

var ErrNotFound = errors.New("club profile not found")

// Profile is the club view used by the club's own app: the public fields plus the admin-set football type.
type Profile struct {
	UserID                string `json:"userId"`
	Name                  string `json:"name"`
	FootballType          string `json:"footballType"`
	District              string `json:"district"`
	Description           string `json:"description"`
	VenueName             string `json:"venueName"`
	VenueAddress          string `json:"venueAddress"`
	TrainingGroundName    string `json:"trainingGroundName"`
	TrainingGroundAddress string `json:"trainingGroundAddress"`
	TrainingSchedule      string `json:"trainingSchedule"`
	// TFF is the club's team in the TFF Ankara standings; nil until the club links it.
	TFF       *TFFLink  `json:"tff"`
	UpdatedAt time.Time `json:"updatedAt"`
}
