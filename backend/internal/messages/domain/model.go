// Package domain holds one-to-one messages (23 Oct 2026). Two accounts may
// write to each other when they are an accepted connection or a club and one
// of its squad players, and neither blocked the other.
package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound    = errors.New("conversation partner not found")
	ErrNotAllowed  = errors.New("messaging is not open between these accounts")
	ErrRateLimited = errors.New("too many messages")
)

const (
	MaxBody  = 1000
	PageSize = 30
	// A sender may send at most this many messages a minute.
	PerMinute = 20
)

type Partner struct {
	ID            string `json:"id"`
	FullName      string `json:"fullName"`
	Role          string `json:"role"`
	Verified      bool   `json:"verified"`
	AvatarVersion int    `json:"avatarVersion"`
}

type Message struct {
	ID        string    `json:"id"`
	Body      string    `json:"body"`
	Mine      bool      `json:"mine"`
	CreatedAt time.Time `json:"createdAt"`
}

type Conversation struct {
	Partner     Partner   `json:"partner"`
	LastMessage *Message  `json:"lastMessage"`
	UpdatedAt   time.Time `json:"updatedAt"`
	Unread      int       `json:"unread"`
	CanSend     bool      `json:"canSend"`
}

type Inbox struct {
	Items  []Conversation `json:"items"`
	Unread int            `json:"unread"`
}

// Thread is one conversation's page of messages, newest first.
type Thread struct {
	Partner    Partner   `json:"partner"`
	CanSend    bool      `json:"canSend"`
	Items      []Message `json:"items"`
	NextCursor string    `json:"nextCursor"`
	// PartnerReadAt lets the sender show "Görüldü" under their last message.
	PartnerReadAt *time.Time `json:"partnerReadAt"`
}

type Cursor struct {
	ID        string
	CreatedAt time.Time
}

type Repository interface {
	Inbox(ctx context.Context, userID string) (Inbox, error)
	Thread(ctx context.Context, userID, partnerID string, before Cursor) (Thread, error)
	Send(ctx context.Context, userID, partnerID, messageID, conversationID, body string) (Message, error)
	MarkRead(ctx context.Context, userID, partnerID string) error
}
