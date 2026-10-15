package domain

import "time"

// A club account is the team's identity; login credentials are never public.
type Club struct {
	UserID                string
	FootballType          string
	District              string
	Description           string
	VenueName             string
	VenueAddress          string
	TrainingGroundName    string
	TrainingGroundAddress string
	TrainingSchedule      string
	UpdatedAt             time.Time
}
