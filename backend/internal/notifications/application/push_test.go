package application

import (
	"context"
	"errors"
	"testing"

	"futcareer/backend/internal/notifications/domain"
)

type fakePushRepo struct {
	pending  []domain.PushMessage
	devices  []domain.PushDevice
	deleted  []string
	register int
}

func (f *fakePushRepo) RegisterDevice(context.Context, string, string, string, string) error {
	f.register++
	return nil
}
func (f *fakePushRepo) ClaimPending(context.Context, int) ([]domain.PushMessage, error) {
	out := f.pending
	f.pending = nil
	return out, nil
}
func (f *fakePushRepo) Devices(context.Context, []string) ([]domain.PushDevice, error) {
	return f.devices, nil
}
func (f *fakePushRepo) DeleteDevice(_ context.Context, token string) error {
	f.deleted = append(f.deleted, token)
	return nil
}

type fakeSender struct{ sent []string }

func (s *fakeSender) Send(_ context.Context, token string, _ domain.PushMessage) error {
	s.sent = append(s.sent, token)
	if token == "stale" {
		return domain.ErrPushTokenInvalid
	}
	if token == "flaky" {
		return errors.New("timeout")
	}
	return nil
}

func TestDispatchSendsToRecipientDevicesAndDropsStaleTokens(t *testing.T) {
	repo := &fakePushRepo{
		pending: []domain.PushMessage{{NotificationID: "n1", RecipientID: "a"}, {NotificationID: "n2", RecipientID: "b"}},
		devices: []domain.PushDevice{{Token: "a-phone", UserID: "a"}, {Token: "stale", UserID: "a"}, {Token: "flaky", UserID: "b"}},
	}
	sender := &fakeSender{}
	claimed, err := NewPush(repo, sender).Dispatch(context.Background())
	if err != nil || claimed != 2 {
		t.Fatalf("dispatch: %d %v", claimed, err)
	}
	if len(sender.sent) != 3 || len(repo.deleted) != 1 || repo.deleted[0] != "stale" {
		t.Fatalf("sent %v deleted %v", sender.sent, repo.deleted)
	}
}

func TestPushWithoutSenderOnlyRegisters(t *testing.T) {
	repo := &fakePushRepo{pending: []domain.PushMessage{{NotificationID: "n1"}}}
	service := NewPush(repo, nil)
	if claimed, err := service.Dispatch(context.Background()); claimed != 0 || err != nil || len(repo.pending) != 1 {
		t.Fatalf("an unconfigured sender claimed notifications: %d %v", claimed, err)
	}
	if err := service.Register(context.Background(), "u", "s", "token", "web"); err == nil {
		t.Fatal("unknown platform accepted")
	}
	if err := service.Register(context.Background(), "u", "s", "token", "ios"); err != nil || repo.register != 1 {
		t.Fatalf("register: %v", err)
	}
}
