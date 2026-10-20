package mail

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFromEnv(t *testing.T) {
	if s, err := FromEnv("", "", ""); s != nil || err != nil {
		t.Fatalf("empty provider must disable mail: %v %v", s, err)
	}
	if _, err := FromEnv("resend", "", "x@y.z"); err == nil {
		t.Fatal("resend without a key accepted")
	}
	if _, err := FromEnv("smtp", "", ""); err == nil {
		t.Fatal("unknown provider accepted")
	}
}

func TestResendPostsTheMessage(t *testing.T) {
	var got map[string]any
	var auth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth = r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&got)
		w.WriteHeader(200)
	}))
	defer server.Close()
	s, _ := FromEnv("resend", "key-1", "Fut Career <no-reply@example.com>")
	r := s.(*Resend)
	r.url = server.URL
	if err := r.Send(context.Background(), Message{To: "a@example.com", Subject: "Kod", Text: "123456"}); err != nil {
		t.Fatal(err)
	}
	if auth != "Bearer key-1" || got["subject"] != "Kod" || got["text"] != "123456" {
		t.Fatalf("request: %q %v", auth, got)
	}
	failing := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(422) }))
	defer failing.Close()
	r.url = failing.URL
	if err := r.Send(context.Background(), Message{To: "a@example.com"}); err == nil {
		t.Fatal("a provider error must be returned")
	}
}
