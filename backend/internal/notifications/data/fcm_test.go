package data

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"futcareer/backend/internal/notifications/domain"
)

func TestFCMSendAndUnregisteredTokens(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	der, _ := x509.MarshalPKCS8PrivateKey(key)
	var sent map[string]any
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "access", "expires_in": 3600})
		case "/projects/fut-career/messages:send":
			if r.Header.Get("Authorization") != "Bearer access" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_ = json.NewDecoder(r.Body).Decode(&sent)
			message := sent["message"].(map[string]any)
			if message["token"] == "gone" {
				w.WriteHeader(http.StatusNotFound)
				_, _ = w.Write([]byte(`{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}`))
				return
			}
			_, _ = w.Write([]byte(`{"name":"projects/fut-career/messages/1"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()
	account, _ := json.Marshal(map[string]string{
		"project_id":   "fut-career",
		"client_email": "push@fut-career.iam.gserviceaccount.com",
		"private_key":  string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})),
		"token_uri":    server.URL + "/token",
	})
	fcm, err := newFCM(account, server.URL+"/projects/", server.Client(), time.Now)
	if err != nil {
		t.Fatal(err)
	}
	message := domain.PushMessage{NotificationID: "n1", Kind: "gift", Title: "Hediye", Body: "Yeni hediyen var", ResourceID: "r1"}
	if err := fcm.Send(context.Background(), "device", message); err != nil {
		t.Fatal(err)
	}
	payload := sent["message"].(map[string]any)
	if payload["notification"].(map[string]any)["title"] != "Hediye" || payload["data"].(map[string]any)["notificationId"] != "n1" {
		t.Fatalf("unexpected payload %v", payload)
	}
	if err := fcm.Send(context.Background(), "gone", message); !errors.Is(err, domain.ErrPushTokenInvalid) {
		t.Fatalf("unregistered token: %v", err)
	}
}
