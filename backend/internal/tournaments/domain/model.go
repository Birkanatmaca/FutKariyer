package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound     = errors.New("tournament not found")
	ErrForbidden    = errors.New("tournament action not allowed for this account")
	ErrClosed       = errors.New("tournament is not accepting entries")
	ErrNotEligible  = errors.New("club type is not eligible for this tournament")
	ErrFull         = errors.New("tournament capacity reached")
	ErrDuplicate    = errors.New("club already entered this tournament")
	ErrInvalidState = errors.New("action not allowed in the current state")
	ErrNotInSquad   = errors.New("roster contains players outside the club squad")
)

const MaxRoster = 30

var Formats = map[string]bool{"halisaha": true, "seven_a_side": true, "eleven_a_side": true}
var TeamTypes = map[string]bool{"amateur": true, "professional": true, "halisaha": true}

// Tournament dates are calendar days (YYYY-MM-DD); there is no time of day.
type Tournament struct {
	ID                  string    `json:"id"`
	OrganizerID         string    `json:"organizerId"`
	OrganizerName       string    `json:"organizerName"`
	Name                string    `json:"name"`
	Format              string    `json:"format"`
	EligibleTypes       []string  `json:"eligibleTypes"`
	District            string    `json:"district"`
	Venue               string    `json:"venue"`
	Description         string    `json:"description"`
	StartsOn            string    `json:"startsOn"`
	EndsOn              string    `json:"endsOn"`
	ApplicationDeadline string    `json:"applicationDeadline"`
	TeamCapacity        int       `json:"teamCapacity"`
	Status              string    `json:"status"`
	AcceptedTeams       int       `json:"acceptedTeams"`
	PendingEntries      int       `json:"pendingEntries"`
	CreatedAt           time.Time `json:"createdAt"`
}

type EntryPlayer struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Position string `json:"position"`
}

type Entry struct {
	ID               string        `json:"id"`
	TournamentID     string        `json:"tournamentId"`
	TournamentName   string        `json:"tournamentName"`
	TournamentStatus string        `json:"tournamentStatus"`
	ClubID           string        `json:"clubId"`
	ClubName         string        `json:"clubName"`
	ClubDistrict     string        `json:"clubDistrict"`
	ClubFootballType string        `json:"clubFootballType"`
	Message          string        `json:"message"`
	Status           string        `json:"status"`
	Players          []EntryPlayer `json:"players"`
	CreatedAt        time.Time     `json:"createdAt"`
	DecidedAt        *time.Time    `json:"decidedAt"`
}

type Page struct {
	Items      []Tournament `json:"items"`
	Page       int          `json:"page"`
	PageSize   int          `json:"pageSize"`
	Total      int          `json:"total"`
	TotalPages int          `json:"totalPages"`
}

type Repository interface {
	Create(ctx context.Context, t Tournament) (Tournament, int, error)
	Mine(ctx context.Context, organizerID string) ([]Tournament, error)
	SetStatus(ctx context.Context, organizerID, id, status string) (Tournament, error)
	Entries(ctx context.Context, organizerID, tournamentID string) ([]Entry, error)
	Decide(ctx context.Context, organizerID, tournamentID, entryID string, accept bool) (Entry, error)
	Open(ctx context.Context, page int) (Page, error)
	Get(ctx context.Context, id string) (Tournament, error)
	Enter(ctx context.Context, clubID, tournamentID, entryID, message string, playerIDs []string) (Entry, error)
	ClubEntries(ctx context.Context, clubID string) ([]Entry, error)
	Withdraw(ctx context.Context, clubID, entryID string) (Entry, error)
}
