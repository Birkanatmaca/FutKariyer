package transport_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	adminapp "futcareer/backend/internal/admin/application"
	admindata "futcareer/backend/internal/admin/data"
	admintransport "futcareer/backend/internal/admin/transport"
	authapp "futcareer/backend/internal/auth/application"
	authdata "futcareer/backend/internal/auth/data"
	"futcareer/backend/internal/discovery/application"
	"futcareer/backend/internal/discovery/data"
	"futcareer/backend/internal/discovery/domain"
	"futcareer/backend/internal/discovery/transport"
	playerapp "futcareer/backend/internal/players/application"
	playerdata "futcareer/backend/internal/players/data"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func TestDiscoveryVisibilityVerificationAndPrivacy(t *testing.T) {
	db := testpostgres.New(t)
	ctx := context.Background()
	auth := authapp.New(authdata.New(db.DB), time.Hour)
	admin := adminapp.New(admindata.New(db.DB))
	players := playerapp.New(playerdata.New(db.DB))
	register := func(name, email string) authapp.AuthResult {
		t.Helper()
		result, err := auth.Register(ctx, authapp.RegisterInput{FullName: name, Email: email, Password: "test-password-123", Role: "player", FootballType: "amateur", LicenseStatus: "licensed"})
		if err != nil {
			t.Fatal(err)
		}
		return result
	}
	player := register("Deniz Yilmaz", "deniz@example.com")
	private := register("Private Player", "private@example.com")
	empty := register("Empty Player", "empty@example.com")
	input := playerapp.SaveInput{Position: "Orta saha", DominantFoot: "left", ExperienceYears: 7, Availability: "open_to_offers", CurrentClub: "Beyan Spor", Discoverable: true, FootballType: "amateur", LicenseStatus: "licensed"}
	if _, err := players.Save(ctx, player.User.ID, input); err != nil {
		t.Fatal(err)
	}
	privateInput := input
	privateInput.Discoverable = false
	if _, err := players.Save(ctx, private.User.ID, privateInput); err != nil {
		t.Fatal(err)
	}
	club, err := admin.Create(ctx, adminapp.CreateInput{AccountInput: authapp.AccountInput{FullName: "Test Club", Username: "test.club", Password: "test-password-123"}, FootballType: "amateur"}, true)
	if err != nil {
		t.Fatal(err)
	}
	coach, err := admin.Create(ctx, adminapp.CreateInput{AccountInput: authapp.AccountInput{FullName: "Test Coach", Email: "coach@example.com", Password: "test-password-123", Role: "coach"}}, false)
	if err != nil {
		t.Fatal(err)
	}
	clubSession, err := auth.Login(ctx, authapp.LoginInput{Identifier: club.Username, Password: "test-password-123"})
	if err != nil {
		t.Fatal(err)
	}
	coachSession, err := auth.Login(ctx, authapp.LoginInput{Identifier: coach.Email, Password: "test-password-123"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = admin.Bootstrap(ctx, authapp.AccountInput{FullName: "Test Admin", Username: "test.admin", Password: "test-password-123"}); err != nil {
		t.Fatal(err)
	}
	adminSession, err := auth.AdminLogin(ctx, authapp.LoginInput{Identifier: "test.admin", Password: "test-password-123"})
	if err != nil {
		t.Fatal(err)
	}
	browser, err := admintransport.BrowserOrigin("http://localhost:5175", false)
	if err != nil {
		t.Fatal(err)
	}
	adminHandler := admintransport.New(auth, admin, browser, nil)
	handler := transport.New(auth, application.New(data.New(db.DB)))
	call := func(path, token string, status int) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest("GET", "/v1/discovery/"+path, nil)
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("%s: got %d want %d: %s", path, w.Code, status, w.Body)
		}
		if w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("discovery may be cached")
		}
		if status == 200 {
			for _, field := range []string{"email", "username", "password", "token", "city", "authVersion"} {
				if strings.Contains(w.Body.String(), `"`+field+`"`) {
					t.Fatalf("private field %s in discovery", field)
				}
			}
		}
		return w
	}
	list := func(path, token string) application.Page {
		t.Helper()
		var page application.Page
		if err := json.Unmarshal(call(path, token, 200).Body.Bytes(), &page); err != nil {
			t.Fatal(err)
		}
		return page
	}
	verify := func(account adminapp.Account, verified bool, cookie, origin string, status int) {
		t.Helper()
		body, _ := json.Marshal(map[string]any{"fullName": account.FullName, "email": account.Email, "username": account.Username, "district": account.District, "footballType": account.FootballType, "active": account.Active, "verified": verified})
		kind := "users"
		if account.Role == "club" {
			kind = "clubs"
		}
		r := httptest.NewRequest("PUT", "/v1/admin/"+kind+"/"+account.ID, bytes.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", origin)
		if cookie != "" {
			r.AddCookie(&http.Cookie{Name: "futcareer_admin", Value: cookie})
		}
		w := httptest.NewRecorder()
		adminHandler.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("verification: got %d want %d: %s", w.Code, status, w.Body)
		}
	}
	call("players", "", 401)
	call("players", adminSession.Token, 401)
	call("players", player.Token, 200)
	call("players", clubSession.Token, 403)
	call("players/"+player.User.ID, coachSession.Token, 403)
	if club.Verified || coach.Verified {
		t.Fatal("provisioning automatically verified an account")
	}
	if page := list("clubs", player.Token); page.Total != 0 {
		t.Fatal("unverified club leaked")
	}
	verify(club, true, clubSession.Token, "http://localhost:5175", 401)
	verify(club, true, adminSession.Token, "https://untrusted.example", 403)
	verify(club, true, adminSession.Token, "http://localhost:5175", 200)
	verify(coach, true, adminSession.Token, "http://localhost:5175", 200)
	verify(adminapp.Account{PublicUser: player.User}, true, adminSession.Token, "http://localhost:5175", 422)
	if page := list("clubs", player.Token); page.Total != 1 || !page.Items[0].Verified || page.Items[0].PlayerProfile != nil {
		t.Fatal("verified club not discovered")
	}
	if page := list("coaches", player.Token); page.Total != 1 {
		t.Fatal("verified coach not discovered")
	}
	if page := list("players", clubSession.Token); page.Total != 1 || page.Items[0].ID != player.User.ID {
		t.Fatalf("visibility filter failed: %+v", page)
	}
	if page := list("players?search=DENIZ&position=orta&dominantFoot=left&availability=open_to_offers", coachSession.Token); page.Total != 1 {
		t.Fatal("combined filters failed")
	}
	for _, path := range []string{"players?search=%25", "players?search=_", "players?position=Forvet", "players?dominantFoot=right", "players?availability=seeking_team"} {
		if page := list(path, clubSession.Token); page.Total != 0 {
			t.Fatalf("filter ignored: %s", path)
		}
	}
	for _, path := range []string{"players?page=0", "players?pageSize=51", "players?page=abc", "players?page=1&page=2", "players?dominantFoot=invalid", "players?availability=invalid", "players?position=" + strings.Repeat("x", 41), "players?search=" + strings.Repeat("x", 101)} {
		call(path, clubSession.Token, 422)
	}
	call("clubs?position=Orta", player.Token, 422)
	call("clubs", coachSession.Token, 403)
	call("invalid", player.Token, 422)
	for _, id := range []string{private.User.ID, empty.User.ID, "missing"} {
		call("players/"+id, clubSession.Token, 404)
	}
	call("clubs/"+coach.ID, player.Token, 404)
	call("players/"+player.User.ID, clubSession.Token, 200)
	call("players/"+player.User.ID, clubSession.Token, 200)
	insights := func(token string, status int) domain.Insights {
		t.Helper()
		r := httptest.NewRequest("GET", "/v1/me/insights", nil)
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("insights got %d want %d: %s", w.Code, status, w.Body)
		}
		var out domain.Insights
		if status == 200 {
			if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
				t.Fatal(err)
			}
		}
		return out
	}
	follow := func(kind, id, token string, on bool, status int) {
		t.Helper()
		body, _ := json.Marshal(map[string]bool{"following": on})
		r := httptest.NewRequest("PUT", "/v1/discovery/"+kind+"/"+id+"/follow", bytes.NewReader(body))
		r.Header.Set("Authorization", "Bearer "+token)
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("follow got %d want %d: %s", w.Code, status, w.Body)
		}
	}
	insights("", 401)
	insights(adminSession.Token, 401)
	if stats := insights(player.Token, 200); stats.ProfileViews != 1 || stats.Followers != 0 || stats.Following != 0 {
		t.Fatalf("view deduplication failed: %+v", stats)
	}
	follow("players", player.User.ID, player.Token, true, 403)
	follow("players", private.User.ID, clubSession.Token, true, 404)
	follow("players", player.User.ID, clubSession.Token, true, 204)
	follow("players", player.User.ID, clubSession.Token, true, 204)
	if stats := insights(player.Token, 200); stats.Followers != 1 {
		t.Fatalf("duplicate follows counted: %+v", stats)
	}
	if stats := insights(clubSession.Token, 200); stats.Following != 1 || stats.Followers != 0 {
		t.Fatalf("insights did not stay personal: %+v", stats)
	}
	var detail struct {
		Profile application.Profile `json:"profile"`
	}
	if err := json.Unmarshal(call("players/"+player.User.ID, clubSession.Token, 200).Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	if !detail.Profile.IsFollowing {
		t.Fatal("following status missing from detail")
	}
	follow("players", player.User.ID, clubSession.Token, false, 204)
	if stats := insights(player.Token, 200); stats.Followers != 0 {
		t.Fatal("unfollow did not reduce count")
	}
	input.Discoverable = false
	if _, err := players.Save(ctx, player.User.ID, input); err != nil {
		t.Fatal(err)
	}
	call("players/"+player.User.ID, clubSession.Token, 404)
	if page := list("players", coachSession.Token); page.Total != 0 {
		t.Fatal("hidden player remained discoverable")
	}
	input.Discoverable = true
	if _, err := players.Save(ctx, player.User.ID, input); err != nil {
		t.Fatal(err)
	}
	verify(club, false, adminSession.Token, "http://localhost:5175", 200)
	call("players", clubSession.Token, 403)
	call("players/"+player.User.ID, clubSession.Token, 403)
	follow("players", player.User.ID, clubSession.Token, true, 403)
	call("clubs/"+club.ID, player.Token, 404)
	// Each page is bounded and ordered deterministically; hidden and out-of-pilot users are excluded.
	for i := 0; i < 23; i++ {
		city, active := "Ankara", true
		if i == 21 {
			city = "Izmir"
		}
		if i == 22 {
			active = false
		}
		id := fmt.Sprintf("paged-%02d", i)
		if _, err := db.DB.ExecContext(ctx, `INSERT INTO users(id,full_name,email,password_hash,role,city,active,created_at) VALUES($1,$1,$2,'unused','player',$3,$4,$5)`, id, id+"@example.com", city, active, time.Now()); err != nil {
			t.Fatal(err)
		}
		if _, err := players.Save(ctx, id, input); err != nil {
			t.Fatal(err)
		}
	}
	first, second := list("players?pageSize=20", coachSession.Token), list("players?page=2&pageSize=20", coachSession.Token)
	if first.Total != 22 || first.TotalPages != 2 || len(first.Items) != 20 || len(second.Items) != 2 {
		t.Fatalf("pagination: %+v / %+v", first, second)
	}
	seen := map[string]bool{}
	for _, p := range append(first.Items, second.Items...) {
		if seen[p.ID] {
			t.Fatal("pages overlap")
		}
		seen[p.ID] = true
	}
	call("players/paged-21", coachSession.Token, 404)
	call("players/paged-22", coachSession.Token, 404)
	coach.Active = false
	verify(coach, true, adminSession.Token, "http://localhost:5175", 200)
	call("players", coachSession.Token, 401)
	call("coaches/"+coach.ID, player.Token, 404)
	db.Reconnect(t)
	auth = authapp.New(authdata.New(db.DB), time.Hour)
	handler = transport.New(auth, application.New(data.New(db.DB)))
	if page := list("clubs", player.Token); page.Total != 0 {
		t.Fatal("verification revoke did not persist")
	}
}
