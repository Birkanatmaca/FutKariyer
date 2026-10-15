package domain

import (
	"context"
	"errors"
)

// ErrPushTokenInvalid means the push service no longer knows the device token.
var ErrPushTokenInvalid = errors.New("push device token is no longer valid")

// PushMessage is one in-app notification sent to the recipient's devices.
type PushMessage struct {
	NotificationID string
	RecipientID    string
	Kind           string
	Title          string
	Body           string
	ResourceID     string
}

type PushDevice struct {
	Token    string
	UserID   string
	Platform string
}

// PushSender delivers to one device (Firebase Cloud Messaging).
type PushSender interface {
	Send(ctx context.Context, token string, message PushMessage) error
}

type PushRepository interface {
	RegisterDevice(ctx context.Context, userID, sessionHash, token, platform string) error
	// ClaimPending marks up to limit undelivered notifications as pushed and
	// returns them; delivery is at most once.
	ClaimPending(ctx context.Context, limit int) ([]PushMessage, error)
	Devices(ctx context.Context, userIDs []string) ([]PushDevice, error)
	DeleteDevice(ctx context.Context, token string) error
}
