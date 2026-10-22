package domain

import (
	"context"
	"errors"

	auth "futcareer/backend/internal/auth/domain"
	clubs "futcareer/backend/internal/clubs/domain"
)

var ErrProtected = errors.New("admin account is protected")
var ErrAdminExists = errors.New("initial admin already exists")

type Record struct {
	User           auth.User
	Club           *clubs.Club
	ApprovalStatus string
	Pro            bool
}

// Query filters the account list. Role is empty or one account role; Status is
// empty, active, inactive (approved but switched off) or pending (waiting for
// application review).
type Query struct {
	Page      int
	PageSize  int
	Search    string
	Role      string
	Status    string
	ClubsOnly bool
}

// Stats are the counts shown above the Kullanıcılar and Kulüpler tables.
type Stats struct {
	Total          int            `json:"total"`
	Active         int            `json:"active"`
	Inactive       int            `json:"inactive"`
	Pending        int            `json:"pending"`
	Verified       int            `json:"verified"`
	Pro            int            `json:"pro"`
	NewLast7Days   int            `json:"newLast7Days"`
	NewLast30Days  int            `json:"newLast30Days"`
	ByRole         map[string]int `json:"byRole"`
	ByFootballType map[string]int `json:"byFootballType"`
	// InLeagues counts clubs playing in at least one league (club stats only).
	InLeagues int `json:"inLeagues"`
}
type Page struct {
	Items []Record
	Total int
}
type Repository interface {
	List(context.Context, Query) (Page, error)
	Get(context.Context, string) (Record, error)
	Create(context.Context, Record) error
	Stats(context.Context, bool) (Stats, error)
	Update(context.Context, Record) error
	Delete(context.Context, string) error
	ResetPassword(context.Context, string, string) error
	Bootstrap(context.Context, auth.User) error
}
