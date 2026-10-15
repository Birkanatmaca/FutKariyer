package application

import (
	"context"
	"errors"
	"log/slog"
	"time"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/notifications/domain"
)

// PushService registers devices and forwards new in-app notifications to them.
// Without a sender (Firebase not configured) devices are still registered and
// notifications stay in the in-app centre only.
type PushService struct {
	repo   domain.PushRepository
	sender domain.PushSender
}

func NewPush(repo domain.PushRepository, sender domain.PushSender) *PushService {
	return &PushService{repo: repo, sender: sender}
}

func (s *PushService) Register(ctx context.Context, userID, sessionHash, token, platform string) error {
	if len(token) < 1 || len(token) > 4096 || (platform != "ios" && platform != "android") {
		return auth.ValidationError{"device": "Geçerli bir cihaz kaydı gönder."}
	}
	return s.repo.RegisterDevice(ctx, userID, sessionHash, token, platform)
}

// Dispatch sends one batch; it returns how many notifications were claimed.
func (s *PushService) Dispatch(ctx context.Context) (int, error) {
	if s.sender == nil {
		return 0, nil
	}
	messages, err := s.repo.ClaimPending(ctx, 100)
	if err != nil || len(messages) == 0 {
		return 0, err
	}
	recipients := make([]string, 0, len(messages))
	seen := map[string]bool{}
	for _, message := range messages {
		if !seen[message.RecipientID] {
			seen[message.RecipientID] = true
			recipients = append(recipients, message.RecipientID)
		}
	}
	devices, err := s.repo.Devices(ctx, recipients)
	if err != nil {
		return len(messages), err
	}
	byUser := map[string][]domain.PushDevice{}
	for _, device := range devices {
		byUser[device.UserID] = append(byUser[device.UserID], device)
	}
	for _, message := range messages {
		for _, device := range byUser[message.RecipientID] {
			err := s.sender.Send(ctx, device.Token, message)
			if errors.Is(err, domain.ErrPushTokenInvalid) {
				if err := s.repo.DeleteDevice(ctx, device.Token); err != nil {
					slog.Error("stale push device could not be removed", "error", err)
				}
			} else if err != nil {
				slog.Warn("push delivery failed", "notification", message.NotificationID, "error", err)
			}
		}
	}
	return len(messages), nil
}

// Run dispatches until ctx ends; a full batch is followed immediately by the next.
func (s *PushService) Run(ctx context.Context, every time.Duration) {
	if s.sender == nil {
		return
	}
	for {
		claimed, err := s.Dispatch(ctx)
		if err != nil && ctx.Err() == nil {
			slog.Error("push dispatch failed", "error", err)
		}
		if claimed == 100 && err == nil {
			continue
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(every):
		}
	}
}
