package data

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"futcareer/backend/internal/notifications/domain"
	"futcareer/backend/internal/platform/googleauth"
)

const fcmScope = "https://www.googleapis.com/auth/firebase.messaging"

// FCM sends through the Firebase Cloud Messaging HTTP v1 API with a service
// account of the Firebase project (APNs is configured inside Firebase).
type FCM struct {
	endpoint string
	tokens   *googleauth.TokenSource
	client   *http.Client
}

var _ domain.PushSender = (*FCM)(nil)

func NewFCM(serviceAccountFile string) (*FCM, error) {
	raw, err := os.ReadFile(serviceAccountFile)
	if err != nil {
		return nil, fmt.Errorf("FIREBASE_SERVICE_ACCOUNT_FILE could not be read: %w", err)
	}
	client := &http.Client{Timeout: 10 * time.Second}
	return newFCM(raw, "https://fcm.googleapis.com/v1/projects/", client, time.Now)
}

func newFCM(raw []byte, base string, client *http.Client, now func() time.Time) (*FCM, error) {
	account, err := googleauth.ParseAccount(raw)
	if err != nil {
		return nil, fmt.Errorf("Firebase %w", err)
	}
	if account.ProjectID == "" {
		return nil, errors.New("Firebase service account has no project_id")
	}
	return &FCM{endpoint: base + account.ProjectID + "/messages:send", tokens: googleauth.NewTokenSource(account, fcmScope, client, now), client: client}, nil
}

func (f *FCM) Send(ctx context.Context, token string, message domain.PushMessage) error {
	body, err := json.Marshal(map[string]any{"message": map[string]any{
		"token":        token,
		"notification": map[string]string{"title": message.Title, "body": message.Body},
		// Opening the push leads to the in-app notification centre.
		"data":    map[string]string{"notificationId": message.NotificationID, "kind": message.Kind, "resourceId": message.ResourceID},
		"android": map[string]any{"priority": "high"},
		"apns":    map[string]any{"payload": map[string]any{"aps": map[string]any{"sound": "default"}}},
	}})
	if err != nil {
		return err
	}
	access, err := f.tokens.Token(ctx)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, f.endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+access)
	req.Header.Set("Content-Type", "application/json")
	response, err := f.client.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusOK {
		return nil
	}
	detail, _ := io.ReadAll(io.LimitReader(response.Body, 8192))
	if response.StatusCode == http.StatusNotFound || strings.Contains(string(detail), "UNREGISTERED") ||
		(response.StatusCode == http.StatusBadRequest && strings.Contains(string(detail), "registration token")) {
		return domain.ErrPushTokenInvalid
	}
	return fmt.Errorf("fcm returned HTTP %d", response.StatusCode)
}
