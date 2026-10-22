// Package domain holds club squad invitations: a club invites a player into
// its squad and the player accepts or declines (22 Oct 2026). Team
// applications remain the other way into a squad.
package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound     = errors.New("squad invitation not found")
	ErrNotInvitable = errors.New("player cannot be invited")
	ErrLimit        = errors.New("too many open squad invitations")
	ErrInvalidState = errors.New("invitation is no longer open")
)

// MaxOpen caps a club's unanswered invitations.
const MaxOpen = 50

type Invite struct {
	ID         string     `json:"id"`
	ClubID     string     `json:"clubId"`
	ClubName   string     `json:"clubName"`
	PlayerID   string     `json:"playerId"`
	PlayerName string     `json:"playerName"`
	Position   string     `json:"position"`
	Message    string     `json:"message"`
	Status     string     `json:"status"`
	CreatedAt  time.Time  `json:"createdAt"`
	DecidedAt  *time.Time `json:"decidedAt"`
}

// Candidate is a discoverable player the club can invite.
type Candidate struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Position string `json:"position"`
}

type Repository interface {
	Candidates(ctx context.Context, clubID, search string) ([]Candidate, error)
	ClubInvites(ctx context.Context, clubID string) ([]Invite, error)
	Invite(ctx context.Context, clubID, playerID, id, message string) (Invite, error)
	Cancel(ctx context.Context, clubID, id string) (Invite, error)
	PlayerInvites(ctx context.Context, playerID string) ([]Invite, error)
	Respond(ctx context.Context, playerID, id string, accept bool) (Invite, error)
}
