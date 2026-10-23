package transport_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	adminapplication "futcareer/backend/internal/admin/application"
	admindata "futcareer/backend/internal/admin/data"
	authapplication "futcareer/backend/internal/auth/application"
	authdata "futcareer/backend/internal/auth/data"
	playerapplication "futcareer/backend/internal/players/application"
	playerdata "futcareer/backend/internal/players/data"
	"futcareer/backend/internal/players/transport"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func TestPlayerProfilePersistenceAndAuthorization(t *testing.T) {
	database := testpostgres.New(t)
	auth := authapplication.New(authdata.New(database.DB), time.Hour)
	register := func(role, email string) authapplication.AuthResult {
		t.Helper()
		result, err := auth.Register(context.Background(), authapplication.RegisterInput{TermsAccepted: true,
			FullName: "Deniz Yılmaz", Email: email, Password: "strong-password", Role: role, FootballType: "amateur", LicenseStatus: "licensed",
		})
		if err != nil {
			t.Fatal(err)
		}
		return result
	}
	player := register("player", "player@example.com")
	_, err := adminapplication.New(admindata.New(database.DB)).Create(context.Background(), adminapplication.CreateInput{
		AccountInput: authapplication.AccountInput{FullName: "Ankara Kulübü", Username: "ankara.club", Password: "strong-password"}, FootballType: "amateur",
	}, true)
	if err != nil {
		t.Fatal(err)
	}
	club, err := auth.Login(context.Background(), authapplication.LoginInput{Identifier: "ankara.club", Password: "strong-password"})
	if err != nil {
		t.Fatal(err)
	}
	handler := transport.New(auth, playerapplication.New(playerdata.New(database.DB)))
	call := func(method, body, token string) *httptest.ResponseRecorder {
		t.Helper()
		request := httptest.NewRequest(method, "/v1/players/me/profile", bytes.NewBufferString(body))
		request.Header.Set("Content-Type", "application/json")
		if token != "" {
			request.Header.Set("Authorization", "Bearer "+token)
		}
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, request)
		return recorder
	}
	read := func() playerapplication.Profile {
		t.Helper()
		recorder := call("GET", "", player.Token)
		if recorder.Code != 200 {
			t.Fatalf("read: %d %s", recorder.Code, recorder.Body)
		}
		var result struct{ Profile playerapplication.Profile }
		if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		return result.Profile
	}
	if response := call("GET", "", ""); response.Code != http.StatusUnauthorized {
		t.Fatal("anonymous profile access was accepted")
	}
	if response := call("GET", "", club.Token); response.Code != http.StatusForbidden {
		t.Fatal("club account accessed player profile editing")
	}
	if profile := read(); profile.Discoverable || profile.Availability != "not_available" {
		t.Fatal("a new player must start private and unavailable")
	}
	input := `{"position":"Orta saha","dominantFoot":"both","experienceYears":8,"currentClub":"Çankaya Spor","availability":"open_to_offers","discoverable":true,"footballType":"amateur","licenseStatus":"licensed"}`
	if response := call("PUT", input, player.Token); response.Code != 200 {
		t.Fatalf("save: %d %s", response.Code, response.Body)
	}
	database.Reconnect(t)
	auth = authapplication.New(authdata.New(database.DB), time.Hour)
	handler = transport.New(auth, playerapplication.New(playerdata.New(database.DB)))
	profile := read()
	if profile.ExperienceYears != 8 || profile.CurrentClub != "Çankaya Spor" || !profile.Discoverable || profile.DominantFoot != "both" {
		t.Fatalf("profile data did not survive reconnect: %+v", profile)
	}
	if _, err := time.Parse(time.RFC3339, profile.UpdatedAt); err != nil {
		t.Fatal("profile timestamp is not RFC3339")
	}
	invalid := `{"position":"Orta saha","dominantFoot":"both","experienceYears":61,"currentClub":"Çankaya Spor","availability":"open_to_offers","discoverable":false,"footballType":"professional","licenseStatus":"unlicensed"}`
	if response := call("PUT", invalid, player.Token); response.Code != 422 {
		t.Fatal("invalid experience was accepted")
	}
	if profile := read(); profile.ExperienceYears != 8 || !profile.Discoverable {
		t.Fatal("failed validation modified persisted profile")
	}
	input = `{"position":"Forvet","dominantFoot":"right","experienceYears":0,"currentClub":"","availability":"seeking_team","discoverable":false,"footballType":"professional","licenseStatus":"unlicensed"}`
	if response := call("PUT", input, player.Token); response.Code != 200 {
		t.Fatalf("update: %d %s", response.Code, response.Body)
	}
	if profile := read(); profile.Position != "Forvet" || profile.Discoverable || profile.ExperienceYears != 0 {
		t.Fatal("profile upsert or boolean update failed")
	}
}
