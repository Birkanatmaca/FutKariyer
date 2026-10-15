package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound    = errors.New("pro account not found")
	ErrNotEligible = errors.New("account type cannot hold pro membership")
	ErrProRequired = errors.New("pro membership required")
)

const (
	// PeriodDays is the length of one paid or granted Pro period.
	PeriodDays = 30
	// BonusCredits is the number of team application rights a player receives per Pro period.
	BonusCredits = 3
)

// EligibleRole reports whether a mobile account type can hold Pro (profile owners only).
func EligibleRole(role string) bool { return role == "player" || role == "club" || role == "coach" }

// Status is the Pro state of one account as evaluated on the server at request time.
type Status struct {
	Active          bool       `json:"active"`
	ExpiresAt       *time.Time `json:"expiresAt"`
	PrivateBrowsing bool       `json:"privateBrowsing"`
	BonusCredits    int        `json:"bonusCredits"`
}

// Extend returns the expiry after adding one period: renewals stack from the later of now and the current expiry.
func Extend(now time.Time, current *time.Time, days int) time.Time {
	start := now
	if current != nil && current.After(now) {
		start = *current
	}
	return start.AddDate(0, 0, days)
}

type Repository interface {
	Status(context.Context, string) (Status, error)
	SetPrivateBrowsing(context.Context, string, bool) (Status, error)
	Grant(context.Context, string, string) (Status, error)
	Revoke(context.Context, string) (Status, error)
}
