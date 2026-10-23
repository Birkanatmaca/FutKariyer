package transport_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	authapp "futcareer/backend/internal/auth/application"
	authdata "futcareer/backend/internal/auth/data"
	"futcareer/backend/internal/content/application"
	"futcareer/backend/internal/content/data"
	"futcareer/backend/internal/content/domain"
	"futcareer/backend/internal/content/transport"
	"futcareer/backend/internal/testsupport/testpostgres"
)

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestPopupSizesIntervalAndCap(t *testing.T) {
	db := testpostgres.New(t)
	ctx := context.Background()
	auth := authapp.New(authdata.New(db.DB), time.Hour)
	service := application.New(data.New(db.DB))
	public := transport.New(auth, service)
	player, err := auth.Register(ctx, authapp.RegisterInput{TermsAccepted: true, FullName: "Deniz Oyuncu", Email: "deniz@example.com", Password: "test-password-123", Role: "player", FootballType: "amateur", LicenseStatus: "licensed"})
	if err != nil {
		t.Fatal(err)
	}
	upload := func(width, height int) string {
		t.Helper()
		var buf bytes.Buffer
		if err := png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, width, height))); err != nil {
			t.Fatal(err)
		}
		id, err := service.Upload(ctx, buf.Bytes())
		if err != nil {
			t.Fatal(err)
		}
		return id
	}
	call := func(method, path string, status int) map[string]any {
		t.Helper()
		r := httptest.NewRequest(method, path, nil)
		r.Header.Set("Authorization", "Bearer "+player.Token)
		w := httptest.NewRecorder()
		public.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("%s %s: got %d want %d: %s", method, path, w.Code, status, w.Body)
		}
		out := map[string]any{}
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return out
	}
	shown := func() map[string]any {
		t.Helper()
		value, _ := call("GET", "/v1/content/popup", 200)["popup"].(map[string]any)
		return value
	}

	// Only the three popup sizes are accepted; the format follows the image.
	var fields authapp.ValidationError
	if _, err := service.SavePopup(ctx, domain.Popup{Title: "Yanlış boy", ImageID: upload(1200, 600), Active: true, IntervalMinutes: 60, MaxViews: 2}, true); !errors.As(err, &fields) || fields["image"] == "" {
		t.Fatalf("a 1200x600 image must be refused: %v", err)
	}
	if _, err := service.SavePopup(ctx, domain.Popup{Title: "Sınır", ImageID: upload(1080, 1080), IntervalMinutes: 0, MaxViews: 101}, true); !errors.As(err, &fields) || fields["intervalMinutes"] == "" || fields["maxViews"] == "" {
		t.Fatalf("interval and cap limits must be checked: %v", err)
	}
	popup, err := service.SavePopup(ctx, domain.Popup{Title: "Turnuva kayıtları açıldı", ImageID: upload(1080, 1350), Active: true, IntervalMinutes: 60, MaxViews: 2}, true)
	if err != nil || popup.Format != "portrait" {
		t.Fatalf("portrait popup: %+v %v", popup, err)
	}

	// Shown when the app opens, with a public image; then it rests for the interval.
	if got := shown(); got["id"] != popup.ID || got["format"] != "portrait" || got["imageId"] != popup.ImageID {
		t.Fatalf("popup should be due: %v", got)
	}
	r := httptest.NewRequest("GET", "/v1/content/images/"+popup.ImageID, nil)
	w := httptest.NewRecorder()
	public.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("active popup image must be public, got %d", w.Code)
	}
	call("POST", "/v1/content/popup/"+popup.ID+"/views", 204)
	call("POST", "/v1/content/popup/"+popup.ID+"/views", 204) // a retry inside the interval is not counted
	if got := shown(); got != nil {
		t.Fatalf("popup must wait for the interval: %v", got)
	}
	rewind := func() {
		t.Helper()
		if _, err := db.DB.Exec(`UPDATE popup_ad_views SET last_seen_at=now()-interval '61 minutes'`); err != nil {
			t.Fatal(err)
		}
	}
	rewind()
	if got := shown(); got["id"] != popup.ID {
		t.Fatalf("popup should come back after the interval: %v", got)
	}
	call("POST", "/v1/content/popup/"+popup.ID+"/views", 204)
	rewind()
	if got := shown(); got != nil {
		t.Fatalf("popup must stop after two showings: %v", got)
	}
	call("POST", "/v1/content/popup/"+popup.ID+"/views", 204)
	list, err := service.Popups(ctx, 1)
	if err != nil || list.Total != 1 || list.Items[0].Views != 2 || list.Items[0].Viewers != 1 {
		t.Fatalf("admin stats: %+v %v", list, err)
	}

	// An inactive popup is neither shown nor serves its image.
	popup.Active = false
	if popup, err = service.SavePopup(ctx, popup, false); err != nil {
		t.Fatal(err)
	}
	if _, err := db.DB.Exec(`DELETE FROM popup_ad_views`); err != nil {
		t.Fatal(err)
	}
	if got := shown(); got != nil {
		t.Fatalf("inactive popup shown: %v", got)
	}
	w = httptest.NewRecorder()
	public.ServeHTTP(w, httptest.NewRequest("GET", "/v1/content/images/"+popup.ImageID, nil))
	if w.Code != 404 {
		t.Fatalf("inactive popup image must not be public, got %d", w.Code)
	}
	if err := service.DeletePopup(ctx, popup.ID); err != nil {
		t.Fatal(err)
	}
	if err := service.DeletePopup(ctx, "not-an-id"); err == nil {
		t.Fatal("a malformed id must not be found")
	}
	r = httptest.NewRequest("GET", "/v1/content/popup", nil)
	w = httptest.NewRecorder()
	public.ServeHTTP(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("popups need a session, got %d", w.Code)
	}
}
