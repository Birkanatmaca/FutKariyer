package domain

import "errors"

// ErrTFFUnavailable means the TFF Ankara page could not be read to check a link.
var ErrTFFUnavailable = errors.New("tff ankara unavailable")

// TFFLink ties a club to its team in the public TFF Ankara standings
// (sezon, lig and grup ids of the federation's page, and the team's name there).
type TFFLink struct {
	Season string `json:"season"`
	League string `json:"league"`
	Group  string `json:"group"`
	Team   string `json:"team"`
	Label  string `json:"label"`
}
