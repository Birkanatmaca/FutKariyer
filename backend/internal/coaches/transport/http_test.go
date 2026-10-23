package transport_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	adminapp "futcareer/backend/internal/admin/application"
	admindata "futcareer/backend/internal/admin/data"
	authapp "futcareer/backend/internal/auth/application"
	authdata "futcareer/backend/internal/auth/data"
	authtransport "futcareer/backend/internal/auth/transport"
	clubapp "futcareer/backend/internal/clubs/application"
	clubdata "futcareer/backend/internal/clubs/data"
	clubtransport "futcareer/backend/internal/clubs/transport"
	coachapp "futcareer/backend/internal/coaches/application"
	coachdata "futcareer/backend/internal/coaches/data"
	"futcareer/backend/internal/coaches/transport"
	leagueapp "futcareer/backend/internal/leagues/application"
	leaguedata "futcareer/backend/internal/leagues/data"
	teamsapp "futcareer/backend/internal/teams/application"
	teamsdata "futcareer/backend/internal/teams/data"
	teamstransport "futcareer/backend/internal/teams/transport"
	"futcareer/backend/internal/testsupport/testpostgres"
)

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestClubStaffInviteSwitchAndRevoke(t *testing.T) {
	db := testpostgres.New(t)
	ctx := context.Background()
	auth := authapp.New(authdata.New(db.DB), time.Hour)
	admin := adminapp.New(admindata.New(db.DB))
	const password = "test-password-123"
	club, err := admin.Create(ctx, adminapp.CreateInput{AccountInput: authapp.AccountInput{FullName: "Merkez FK", Username: "merkez.fk", Password: password}, FootballType: "amateur"}, true)
	if err != nil {
		t.Fatal(err)
	}
	coach, err := admin.Create(ctx, adminapp.CreateInput{AccountInput: authapp.AccountInput{FullName: "Ayşe Hoca", Email: "ayse@example.com", Password: password, Role: "coach"}}, false)
	if err != nil {
		t.Fatal(err)
	}
	player, err := auth.Register(ctx, authapp.RegisterInput{TermsAccepted: true, FullName: "Deniz Oyuncu", Email: "deniz@example.com", Password: password, Role: "player", FootballType: "amateur", LicenseStatus: "licensed"})
	if err != nil {
		t.Fatal(err)
	}
	login := func(identifier string) string {
		t.Helper()
		result, err := auth.Login(ctx, authapp.LoginInput{Identifier: identifier, Password: password})
		if err != nil {
			t.Fatal(err)
		}
		return result.Token
	}
	clubToken, coachToken := login(club.Username), login(coach.Email)

	routes := http.NewServeMux()
	coaches := transport.New(auth, coachapp.New(coachdata.New(db.DB)))
	for _, path := range []string{"/v1/me/coach-profile", "/v1/me/staff", "/v1/me/staff/", "/v1/me/coach-clubs", "/v1/me/coach-clubs/", "/v1/staff/"} {
		routes.Handle(path, coaches)
	}
	clubs := clubtransport.New(auth, clubapp.New(clubdata.New(db.DB), leagueapp.New(leaguedata.New(db.DB)), nil))
	routes.Handle("/v1/me/squad", clubs)
	routes.Handle("/v1/me/club-profile", clubs)
	routes.Handle("/v1/teams/", teamstransport.New(auth, teamsapp.New(teamsdata.New(db.DB))))
	routes.Handle("/", authtransport.New(auth))
	handler := authtransport.DelegationGuard(auth, routes)

	call := func(method, path, token string, body any, status int) map[string]any {
		t.Helper()
		var payload []byte
		if body != nil {
			payload, _ = json.Marshal(body)
		}
		r := httptest.NewRequest(method, path, bytes.NewReader(payload))
		r.Header.Set("Authorization", "Bearer "+token)
		if body != nil {
			r.Header.Set("Content-Type", "application/json")
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("%s %s: got %d want %d: %s", method, path, w.Code, status, w.Body)
		}
		out := map[string]any{}
		if w.Body.Len() > 0 {
			_ = json.Unmarshal(w.Body.Bytes(), &out)
		}
		return out
	}

	// The coach fills in a profile and shows only the licence publicly.
	call("PUT", "/v1/me/coach-profile", coachToken, map[string]any{
		"licenseLevel": "uefa_b", "specialties": []string{"head_coach", "youth"}, "experienceYears": 8,
		"footballType": "amateur", "availability": "open_to_offers", "pastClubs": []string{"Eski, Spor"},
		"visibility": map[string]bool{"license": true},
	}, 200)
	public := call("GET", "/v1/staff/coaches/"+coach.ID, player.Token, nil, 200)
	profile := public["profile"].(map[string]any)
	if profile["licenseLevel"] != "uefa_b" || profile["experienceYears"] != nil || profile["pastClubs"] != nil || public["full"] != false {
		t.Fatalf("player saw hidden coach details: %v", public)
	}
	full := call("GET", "/v1/staff/coaches/"+coach.ID, clubToken, nil, 200)
	if full["full"] != true || full["profile"].(map[string]any)["experienceYears"] != float64(8) {
		t.Fatalf("club must see the whole coach profile: %v", full)
	}
	if clubsList := full["profile"].(map[string]any)["pastClubs"].([]any); len(clubsList) != 1 || clubsList[0] != "Eski, Spor" {
		t.Fatalf("past clubs lost their comma: %v", clubsList)
	}

	// Only clubs invite; the coach cannot switch before accepting.
	if items := call("GET", "/v1/me/staff/candidates?q=ayş", clubToken, nil, 200)["items"].([]any); len(items) != 1 {
		t.Fatalf("club should find the coach: %v", items)
	}
	call("GET", "/v1/me/staff", coachToken, nil, 403)
	call("POST", "/v1/me/staff", clubToken, map[string]any{"coachId": coach.ID, "role": "assistant", "permissions": []string{"squad"}}, 200)
	call("POST", "/v1/me/staff", clubToken, map[string]any{"coachId": coach.ID, "role": "assistant", "permissions": []string{}}, 409)
	call("POST", "/v1/auth/switch", coachToken, map[string]string{"clubId": club.ID}, 403)
	memberships := call("PUT", "/v1/me/coach-clubs/"+club.ID, coachToken, map[string]bool{"accept": true}, 200)["clubs"].([]any)
	if memberships[0].(map[string]any)["status"] != "active" {
		t.Fatalf("invitation not accepted: %v", memberships)
	}
	var notes int
	if err := db.DB.QueryRow(`SELECT count(*) FROM notifications WHERE kind='staff'`).Scan(&notes); err != nil || notes != 2 {
		t.Fatalf("want invite and accept notifications, got %d (%v)", notes, err)
	}

	// Switching gives a club session that only reaches the allowed sections.
	switched := call("POST", "/v1/auth/switch", coachToken, map[string]string{"clubId": club.ID}, 200)
	delegated := switched["token"].(string)
	if expires, err := time.Parse(time.RFC3339Nano, switched["expiresAt"].(string)); err != nil || time.Until(expires) > 8*time.Hour+time.Minute {
		t.Fatalf("a club session lasts at most 8 hours: %v %v", switched["expiresAt"], err)
	}
	me := call("GET", "/v1/auth/me", delegated, nil, 200)["user"].(map[string]any)
	if me["role"] != "club" || me["delegate"].(map[string]any)["coachName"] != "Ayşe Hoca" {
		t.Fatalf("switched session must be the club with the coach as delegate: %v", me)
	}
	if me["email"] != "" {
		t.Fatalf("the club's email must stay private from the coach: %v", me["email"])
	}
	call("GET", "/v1/connections", delegated, nil, 403)
	call("POST", "/v1/auth/switch", delegated, map[string]string{"clubId": club.ID}, 403)
	call("GET", "/v1/me/squad", delegated, nil, 200)
	if body := call("GET", "/v1/teams/me/join-requests", delegated, nil, 403); !strings.Contains(body["error"].(map[string]any)["code"].(string), "delegate") {
		t.Fatalf("applications must be closed: %v", body)
	}
	call("DELETE", "/v1/auth/account", delegated, map[string]string{"password": password}, 403)
	call("PUT", "/v1/me/club-profile", delegated, map[string]string{}, 403)
	call("POST", "/v1/social/posts", delegated, map[string]string{"text": "x"}, 403)
	call("GET", "/v1/me/staff", delegated, nil, 403)

	// Permissions follow the club's latest choice on the next request.
	call("PUT", "/v1/me/staff/"+coach.ID, clubToken, map[string]any{"role": "head_coach", "permissions": []string{"applications"}}, 200)
	call("GET", "/v1/teams/me/join-requests", delegated, nil, 200)
	call("GET", "/v1/me/squad", delegated, nil, 403)

	// Removing the coach ends the switched session but not the coach's own.
	call("DELETE", "/v1/me/staff/"+coach.ID, clubToken, nil, 204)
	call("GET", "/v1/auth/me", delegated, nil, 401)
	call("GET", "/v1/auth/me", coachToken, nil, 200)
	call("GET", "/v1/auth/me", clubToken, nil, 200)
	var left int
	if err := db.DB.QueryRow(`SELECT count(*) FROM sessions WHERE acting_user_id=$1`, coach.ID).Scan(&left); err != nil || left != 0 {
		t.Fatalf("switched sessions must be deleted, %d left (%v)", left, err)
	}
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestCoachSelfRegistration(t *testing.T) {
	db := testpostgres.New(t)
	auth := authapp.New(authdata.New(db.DB), time.Hour)
	routes := http.NewServeMux()
	coaches := transport.New(auth, coachapp.New(coachdata.New(db.DB)))
	routes.Handle("/v1/me/coach-profile", coaches)
	routes.Handle("/v1/staff/", coaches)
	routes.Handle("/", authtransport.New(auth))
	handler := authtransport.DelegationGuard(auth, routes)
	call := func(method, path, token string, body any, status int) map[string]any {
		t.Helper()
		var payload []byte
		if body != nil {
			payload, _ = json.Marshal(body)
		}
		r := httptest.NewRequest(method, path, bytes.NewReader(payload))
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		if body != nil {
			r.Header.Set("Content-Type", "application/json")
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("%s %s: got %d want %d: %s", method, path, w.Code, status, w.Body)
		}
		out := map[string]any{}
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return out
	}
	const password = "test-password-123"
	signUp := func(body map[string]any, status int) map[string]any {
		t.Helper()
		body["password"] = password
		body["termsAccepted"] = true
		return call("POST", "/v1/auth/register", "", body, status)
	}
	fields := func(out map[string]any) map[string]any {
		return out["error"].(map[string]any)["fields"].(map[string]any)
	}

	// Clubs still apply for approval; a coach must name a licence level.
	if f := fields(signUp(map[string]any{"fullName": "Merkez FK", "email": "kulup@example.com", "role": "club", "footballType": "amateur"}, 422)); f["role"] == nil {
		t.Fatalf("club self sign-up must be refused: %v", f)
	}
	if f := fields(signUp(map[string]any{"fullName": "Ayşe Hoca", "email": "ayse@example.com", "role": "coach", "footballType": "amateur"}, 422)); f["licenseLevel"] == nil {
		t.Fatalf("coach without a licence level must be refused: %v", f)
	}

	// The account opens at once, unverified, and its first session works.
	coach := signUp(map[string]any{"fullName": "Ayşe Hoca", "email": "ayse@example.com", "role": "coach", "footballType": "halisaha", "licenseLevel": "uefa_c"}, 201)
	user := coach["user"].(map[string]any)
	if user["role"] != "coach" || user["active"] != true || user["verified"] != false {
		t.Fatalf("unexpected coach account: %v", user)
	}
	token := coach["token"].(string)
	profile := call("GET", "/v1/me/coach-profile", token, nil, 200)["profile"].(map[string]any)
	visibility := profile["visibility"].(map[string]any)
	if profile["licenseLevel"] != "uefa_c" || profile["footballType"] != "halisaha" || profile["availability"] != "not_available" {
		t.Fatalf("sign-up details were not stored: %v", profile)
	}
	for group, shown := range visibility {
		if shown != false {
			t.Fatalf("%s must start hidden: %v", group, visibility)
		}
	}
	// The same email cannot sign up twice, whatever the role.
	signUp(map[string]any{"fullName": "Ayşe Hoca", "email": "ayse@example.com", "role": "player", "footballType": "amateur", "licenseStatus": "licensed"}, 409)

	// Other members see none of the hidden sign-up details.
	player := signUp(map[string]any{"fullName": "Deniz Oyuncu", "email": "deniz@example.com", "role": "player", "footballType": "amateur", "licenseStatus": "licensed"}, 201)
	public := call("GET", "/v1/staff/coaches/"+user["id"].(string), player["token"].(string), nil, 200)["profile"].(map[string]any)
	if public["licenseLevel"] != nil || public["footballType"] != nil {
		t.Fatalf("hidden sign-up details leaked: %v", public)
	}
	var rows int
	if err := db.DB.QueryRow(`SELECT count(*) FROM coach_profiles`).Scan(&rows); err != nil || rows != 1 {
		t.Fatalf("want one coach profile, got %d (%v)", rows, err)
	}
}
