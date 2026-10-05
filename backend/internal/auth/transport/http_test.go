package transport_test

import (
	"bytes"
	"encoding/json"
	"futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/auth/data"
	"futcareer/backend/internal/auth/transport"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
)

func TestAuthHTTPContract(t *testing.T) {
	repo, err := data.Open(filepath.Join(t.TempDir(), "http.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close()
	handler := transport.New(application.New(repo, time.Hour))
	call := func(method, path, body, token string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec
	}
	rec := call("POST", "/v1/auth/register", `{"fullName":"Deniz Yılmaz","email":"deniz@example.com","password":"strong-password","role":"player","adultConfirmed":true}`, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("register: %d %s", rec.Code, rec.Body)
	}
	if bytes.Contains(rec.Body.Bytes(), []byte("password")) {
		t.Fatal("password information in public response")
	}
	var result application.AuthResult
	if err = json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if rec = call("GET", "/v1/auth/me", "", result.Token); rec.Code != 200 {
		t.Fatalf("me: %d", rec.Code)
	}
	if rec = call("POST", "/v1/auth/login", `{"email":"deniz@example.com","password":"incorrect"}`, ""); rec.Code != 401 {
		t.Fatal("invalid credentials accepted")
	}
	if rec = call("POST", "/v1/auth/logout", "", result.Token); rec.Code != 204 {
		t.Fatalf("logout: %d", rec.Code)
	}
	if rec = call("GET", "/v1/auth/me", "", result.Token); rec.Code != 401 {
		t.Fatal("revoked bearer token accepted")
	}
	if rec = call("POST", "/v1/auth/register", `{} {}`, ""); rec.Code != 400 {
		t.Fatal("multiple JSON objects accepted")
	}
}
