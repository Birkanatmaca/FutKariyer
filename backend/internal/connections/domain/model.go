package domain

import (
	"context"
	"errors"
	"time"
)

var (
	// ErrNotFound also covers recipients the sender is not allowed to reach, so
	// hidden profiles are indistinguishable from missing ones.
	ErrNotFound      = errors.New("connection not found")
	ErrDuplicate     = errors.New("connection already open for this pair")
	ErrRateLimited   = errors.New("daily connection request limit reached")
	ErrInvalidAction = errors.New("connection action not allowed in this state")
)

// DailyLimit caps new requests per sender in a rolling 24 hours.
const DailyLimit = 20

type Party struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	Verified bool   `json:"verified"`
	District string `json:"district"`
}

// Contact is only filled for accepted connections.
type Contact struct {
	Email string `json:"email"`
}

type Connection struct {
	ID          string     `json:"id"`
	Status      string     `json:"status"`
	Direction   string     `json:"direction"`
	Message     string     `json:"message"`
	CreatedAt   time.Time  `json:"createdAt"`
	RespondedAt *time.Time `json:"respondedAt"`
	Other       Party      `json:"other"`
	Contact     *Contact   `json:"contact"`
}

type Inbox struct {
	Incoming []Connection `json:"incoming"`
	Outgoing []Connection `json:"outgoing"`
	Accepted []Connection `json:"accepted"`
}

// PairStatus is the viewer's relationship with one other account: none, outgoing, incoming or connected.
type PairStatus struct {
	State        string `json:"state"`
	ConnectionID string `json:"connectionId"`
}

type Repository interface {
	Send(ctx context.Context, id, senderID, recipientID, message string) (Connection, error)
	Inbox(ctx context.Context, userID string) (Inbox, error)
	Respond(ctx context.Context, userID, id, action string) (Connection, error)
	Status(ctx context.Context, userID, otherID string) (PairStatus, error)
}
