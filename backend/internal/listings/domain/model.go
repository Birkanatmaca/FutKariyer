package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound    = errors.New("listing not found")
	ErrTooManyOpen = errors.New("too many open listings")
)

// MaxOpenPerClub keeps the listing feed varied and stops one club from flooding it.
const MaxOpenPerClub = 10

type Listing struct {
	ID           string     `json:"id"`
	ClubID       string     `json:"clubId"`
	ClubName     string     `json:"clubName"`
	District     string     `json:"district"`
	FootballType string     `json:"footballType"`
	Title        string     `json:"title"`
	Position     string     `json:"position"`
	Description  string     `json:"description"`
	Status       string     `json:"status"`
	CreatedAt    time.Time  `json:"createdAt"`
	ClosedAt     *time.Time `json:"closedAt"`
	// Applications is only filled for the owning club.
	Applications *int `json:"applications,omitempty"`
}

type Page struct {
	Items      []Listing `json:"items"`
	Page       int       `json:"page"`
	PageSize   int       `json:"pageSize"`
	Total      int       `json:"total"`
	TotalPages int       `json:"totalPages"`
}

type Repository interface {
	Create(context.Context, Listing) (Listing, int, error)
	Mine(context.Context, string) ([]Listing, error)
	Close(context.Context, string, string) (Listing, error)
	Open(context.Context, string, int) (Page, error)
	Get(context.Context, string) (Listing, error)
}
