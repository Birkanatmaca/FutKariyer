package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound       = errors.New("team not found")
	ErrForbidden      = errors.New("team action not allowed")
	ErrQuotaExhausted = errors.New("team join request quota exhausted")
	ErrDuplicate      = errors.New("team join request already exists")
	ErrRequestClosed  = errors.New("team join request is no longer pending")
)

const RequestLimit = 3

type Team struct {
	ID                    string
	Name                  string
	FootballType          string
	District              string
	Description           string
	VenueName             string
	VenueAddress          string
	TrainingGroundName    string
	TrainingGroundAddress string
	TrainingSchedule      string
}

type Query struct {
	ViewerID string
	Search   string
	Page     int
	PageSize int
}

type Page[T any] struct {
	Items      []T
	Page       int
	PageSize   int
	Total      int
	TotalPages int
}

type Quota struct {
	Included  int `json:"included"`
	Purchased int `json:"purchased"`
	Earned    int `json:"earned"`
	Pro       int `json:"pro"`
	Used      int `json:"used"`
	Remaining int `json:"remaining"`
	Limit     int `json:"limit"`
}

// NewQuota totals the initial free rights, paid packages, game/gift rewards and Pro period rights.
func NewQuota(used, purchased, earned, pro int) Quota {
	limit := RequestLimit + purchased + earned + pro
	remaining := limit - used
	if remaining < 0 {
		remaining = 0
	}
	return Quota{Included: RequestLimit, Purchased: purchased, Earned: earned, Pro: pro, Used: used, Remaining: remaining, Limit: limit}
}

type JoinRequest struct {
	ID         string    `json:"id"`
	PlayerID   string    `json:"-"`
	PlayerName string    `json:"playerName,omitempty"`
	ClubID     string    `json:"-"`
	ClubName   string    `json:"clubName,omitempty"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type TeamApplication struct {
	ID            string    `json:"id"`
	TeamID        string    `json:"teamId"`
	TeamName      string    `json:"teamName"`
	TeamDistrict  string    `json:"teamDistrict"`
	TeamAvailable bool      `json:"teamAvailable"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

type Repository interface {
	List(context.Context, Query) (Page[Team], error)
	Get(context.Context, string) (Team, error)
	RequestStatus(context.Context, string, string) (string, error)
	Quota(context.Context, string) (Quota, error)
	PlayerRequests(context.Context, string, int, int) (Page[TeamApplication], Quota, error)
	CreateRequest(context.Context, string, string, string, string) (JoinRequest, Quota, error)
	ListRequests(context.Context, string, string, int, int) (Page[JoinRequest], error)
	DecideRequest(context.Context, string, string, string) (JoinRequest, error)
}
