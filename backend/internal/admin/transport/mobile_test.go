package transport_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	adminapp "futcareer/backend/internal/admin/application"
	admindata "futcareer/backend/internal/admin/data"
	admintransport "futcareer/backend/internal/admin/transport"
	authapp "futcareer/backend/internal/auth/application"
	authdata "futcareer/backend/internal/auth/data"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func TestMobileAdminBearerSessions(t *testing.T) {
	db := testpostgres.New(t)
	ctx := context.Background()
	auth := authapp.New(authdata.New(db.DB), time.Hour)
	admin := adminapp.New(admindata.New(db.DB))
	if _, err := admin.Bootstrap(ctx, authapp.AccountInput{FullName: "Mobil Yönetici", Email: "admin@example.com", Username: "mobile.admin", Password: "test-password-123"}); err != nil {
		t.Fatal(err)
	}
	player, err := auth.Register(ctx, authapp.RegisterInput{TermsAccepted: true, FullName: "Test Player", Email: "player@example.com", Password: "test-password-123", Role: "player", FootballType: "amateur", LicenseStatus: "licensed"})
	if err != nil {
		t.Fatal(err)
	}
	browser, err := admintransport.BrowserOrigin("http://localhost:5175", false)
	if err != nil {
		t.Fatal(err)
	}
	var featurePaths []string
	features := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		featurePaths = append(featurePaths, r.URL.Path)
		w.WriteHeader(204)
	})
	h := admintransport.New(auth, admin, browser, features)
	call := func(method, path, bearer, cookie, origin string, body any, status int) *httptest.ResponseRecorder {
		t.Helper()
		raw, _ := json.Marshal(body)
		r := httptest.NewRequest(method, path, bytes.NewReader(raw))
		r.Header.Set("Content-Type", "application/json")
		if bearer != "" {
			r.Header.Set("Authorization", "Bearer "+bearer)
		}
		if cookie != "" {
			r.AddCookie(&http.Cookie{Name: "futcareer_admin", Value: cookie})
		}
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("%s %s: got %d want %d: %s", method, path, w.Code, status, w.Body)
		}
		return w
	}

	// Email login from the app returns a bearer token in the body and sets no cookie.
	w := call("POST", "/v1/admin/auth/token", "", "", "", map[string]string{"identifier": "ADMIN@example.com", "password": "test-password-123"}, 200)
	if len(w.Result().Cookies()) != 0 {
		t.Fatal("mobile admin login set a cookie")
	}
	var login struct {
		Token string `json:"token"`
		User  struct {
			Role string `json:"role"`
		} `json:"user"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &login); err != nil || login.Token == "" || login.User.Role != "admin" {
		t.Fatalf("login body: %s", w.Body)
	}
	call("POST", "/v1/admin/auth/token", "", "", "", map[string]string{"identifier": "admin@example.com", "password": "wrong-password-1"}, 401)
	call("POST", "/v1/admin/auth/token", "", "", "", map[string]string{"identifier": "player@example.com", "password": "test-password-123"}, 403)

	// Bearer sessions need no Origin; account routes and every feature route are reachable.
	call("GET", "/v1/admin/auth/me", login.Token, "", "", nil, 200)
	call("GET", "/v1/admin/users?page=1", login.Token, "", "", nil, 200)
	call("GET", "/v1/admin/users/stats", login.Token, "", "", nil, 200)
	call("GET", "/v1/admin/payments", login.Token, "", "", nil, 204)
	call("POST", "/v1/admin/leagues", login.Token, "", "", map[string]string{}, 204)
	if len(featurePaths) != 2 || featurePaths[0] != "/v1/admin/payments" {
		t.Fatalf("feature routing: %v", featurePaths)
	}

	// A mobile (non-admin) session never opens the admin area, and cookie
	// sessions keep the Origin check even when the token is valid.
	call("GET", "/v1/admin/users", player.Token, "", "", nil, 401)
	call("POST", "/v1/admin/users", "", login.Token, "https://evil.example", map[string]string{}, 403)

	// Logout revokes the bearer token.
	call("POST", "/v1/admin/auth/logout", login.Token, "", "", nil, 204)
	call("GET", "/v1/admin/auth/me", login.Token, "", "", nil, 401)
}
