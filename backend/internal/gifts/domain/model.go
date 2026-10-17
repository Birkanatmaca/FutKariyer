package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound    = errors.New("gift not found")
	ErrForbidden   = errors.New("gift access denied")
	ErrExpired     = errors.New("gift expired")
	ErrNoRecipient = errors.New("gift recipient not found")
	ErrKindRole    = errors.New("gift kind does not match account role")
)

// Heart gifts (heart_one, heart_full) were retired with hearts on 17 Oct 2026;
// old rows stay in the history but are hidden from inboxes and cannot be claimed.
const (
	KindApplicationRight = "application_right"
	AudienceAll          = "all"
	AudienceAccount      = "account"
	StatusAvailable      = "available"
	StatusClaimed        = "claimed"
	StatusExpired        = "expired"
	MaxValidityDays      = 365
)

func ValidKind(kind string) bool {
	return kind == KindApplicationRight
}

// Gift is a campaign created by an administrator. Each recipient gets a UserGift row.
type Gift struct {
	ID           string
	Kind         string
	Title        string
	Message      string
	Audience     string
	TargetEmail  string
	ValidityDays int
	CreatedAt    time.Time
	Recipients   int
	Claimed      int
}

// MyGift is one recipient's copy of a gift.
type MyGift struct {
	ID        string
	Kind      string
	Title     string
	Message   string
	CreatedAt time.Time
	ExpiresAt time.Time
	ClaimedAt *time.Time
}

// Status derives availability from the claim and expiry timestamps.
func (g MyGift) Status(now time.Time) string {
	if g.ClaimedAt != nil {
		return StatusClaimed
	}
	if !now.Before(g.ExpiresAt) {
		return StatusExpired
	}
	return StatusAvailable
}

type Repository interface {
	CreateGift(context.Context, Gift, string) (Gift, error)
	ListGifts(context.Context) ([]Gift, error)
	MyGifts(context.Context, string) ([]MyGift, time.Time, error)
	Claim(context.Context, string, string) (ClaimResult, error)
}

type ClaimResult struct {
	Gift           MyGift
	AlreadyClaimed bool
}
