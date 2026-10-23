package transport_test

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/png"
	"mime/multipart"
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
	"futcareer/backend/internal/content/application"
	"futcareer/backend/internal/content/data"
	"futcareer/backend/internal/content/domain"
	"futcareer/backend/internal/content/transport"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func TestContentPublicationUploadAndAdministratorBoundary(t *testing.T) {
	db := testpostgres.New(t)
	ctx := context.Background()
	auth := authapp.New(authdata.New(db.DB), time.Hour)
	admin := adminapp.New(admindata.New(db.DB))
	if _, err := admin.Bootstrap(ctx, authapp.AccountInput{FullName: "Editor", Username: "test.editor", Password: "test-password-123"}); err != nil {
		t.Fatal(err)
	}
	editor, err := auth.AdminLogin(ctx, authapp.LoginInput{Identifier: "test.editor", Password: "test-password-123"})
	if err != nil {
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
	service := application.New(data.New(db.DB))
	adminHandler := admintransport.New(auth, admin, browser, transport.NewAdmin(service))
	publicHandler := transport.New(auth, service)
	call := func(h http.Handler, method, path, token, origin, contentType string, body []byte, status int) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, bytes.NewReader(body))
		if strings.HasPrefix(path, "/v1/admin/") && token != "" {
			r.AddCookie(&http.Cookie{Name: "futcareer_admin", Value: token})
		} else {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		r.Header.Set("Origin", origin)
		r.Header.Set("Content-Type", contentType)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("%s %s: got %d want %d: %s", method, path, w.Code, status, w.Body)
		}
		if w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("editorial content can be cached")
		}
		return w
	}
	get := func(path string, status int) *httptest.ResponseRecorder {
		t.Helper()
		return call(publicHandler, "GET", "/v1/content/"+path, player.Token, "", "", nil, status)
	}
	write := func(method, path string, input any, status int) *httptest.ResponseRecorder {
		t.Helper()
		body, _ := json.Marshal(input)
		return call(adminHandler, method, "/v1/admin/content/"+path, editor.Token, "http://localhost:5175", "application/json", body, status)
	}
	decode := func(w *httptest.ResponseRecorder, out any) {
		t.Helper()
		if err := json.Unmarshal(w.Body.Bytes(), out); err != nil {
			t.Fatal(err)
		}
	}
	call(publicHandler, "GET", "/v1/content/home", "", "", "", nil, 401)
	call(publicHandler, "GET", "/v1/content/home", editor.Token, "", "", nil, 401)
	call(adminHandler, "GET", "/v1/admin/content/news", player.Token, "", "", nil, 401)
	call(adminHandler, "POST", "/v1/admin/content/ads", editor.Token, "https://untrusted.example", "application/json", []byte(`{}`), 403)
	write("POST", "ads", map[string]any{"title": "Missing image"}, 422)
	write("POST", "news", map[string]any{"title": "Short", "summary": "", "body": ""}, 422)
	upload := func(raw []byte, status int) string {
		t.Helper()
		var body bytes.Buffer
		form := multipart.NewWriter(&body)
		file, err := form.CreateFormFile("image", "test.png")
		if err != nil {
			t.Fatal(err)
		}
		if _, err = file.Write(raw); err != nil {
			t.Fatal(err)
		}
		if err = form.Close(); err != nil {
			t.Fatal(err)
		}
		w := call(adminHandler, "POST", "/v1/admin/content/images", editor.Token, "http://localhost:5175", form.FormDataContentType(), body.Bytes(), status)
		if status != 201 {
			return ""
		}
		var result struct {
			ImageID string `json:"imageId"`
		}
		decode(w, &result)
		return result.ImageID
	}
	upload([]byte(`<svg xmlns="http://www.w3.org/2000/svg"/>`), 422)
	upload(make([]byte, application.MaxImageBytes+1), 422)
	var pngBytes bytes.Buffer
	if err := png.Encode(&pngBytes, image.NewRGBA(image.Rect(0, 0, 160, 90))); err != nil {
		t.Fatal(err)
	}
	imageID := upload(pngBytes.Bytes(), 201)
	call(publicHandler, "GET", "/v1/content/images/"+imageID, "", "", "", nil, 404)
	call(adminHandler, "GET", "/v1/admin/content/images/"+imageID, editor.Token, "", "", nil, 200)
	var ad struct {
		Advertisement domain.Advertisement `json:"advertisement"`
	}
	adInput := map[string]any{"title": "Test advertisement", "imageId": imageID, "active": true, "sortOrder": 3}
	decode(write("POST", "ads", adInput, 201), &ad)
	asset := call(publicHandler, "GET", "/v1/content/images/"+imageID, "", "", "", nil, 200)
	if asset.Header().Get("Content-Type") != "image/png" {
		t.Fatal("wrong image type")
	}
	if _, err := png.Decode(bytes.NewReader(asset.Body.Bytes())); err != nil {
		t.Fatal(err)
	}
	var article struct {
		Article domain.Article `json:"article"`
	}
	newsInput := map[string]any{"title": "Home headline", "summary": "A real stored summary", "body": "Full news text", "published": true, "showOnHome": true}
	decode(write("POST", "news", newsInput, 201), &article)
	featuredID := article.Article.ID
	newsInput["title"], newsInput["showOnHome"] = "Only on News page", false
	decode(write("POST", "news", newsInput, 201), &article)
	listedID := article.Article.ID
	newsInput["title"], newsInput["published"], newsInput["showOnHome"] = "Private draft", false, true
	draftImage := upload(pngBytes.Bytes(), 201)
	newsInput["imageId"] = draftImage
	decode(write("POST", "news", newsInput, 201), &article)
	draftID := article.Article.ID
	var home domain.Home
	decode(get("home", 200), &home)
	if len(home.Advertisements) != 1 || home.Advertisements[0].ID != ad.Advertisement.ID || len(home.News) != 1 || home.News[0].ID != featuredID {
		t.Fatalf("wrong home publication: %+v", home)
	}
	var list domain.Page[domain.Article]
	decode(get("news", 200), &list)
	if list.Total != 2 || list.Items[0].ID != listedID {
		t.Fatalf("wrong news publication: %+v", list)
	}
	decode(call(adminHandler, "GET", "/v1/admin/content/news", editor.Token, "", "", nil, 200), &list)
	if list.Total != 3 {
		t.Fatal("admin lost draft")
	}
	get("news/"+draftID, 404)
	call(publicHandler, "GET", "/v1/content/images/"+draftImage, "", "", "", nil, 404)
	get("news?page=0", 422)
	get("news?page=1&page=2", 422)
	// A home flag never overrides publication, and editing it does not delete the article.
	newsInput["title"], newsInput["published"], newsInput["showOnHome"], newsInput["imageId"] = "Home headline", true, false, ""
	write("PUT", "news/"+featuredID, newsInput, 200)
	decode(get("home", 200), &home)
	if len(home.News) != 0 {
		t.Fatal("home flag ignored")
	}
	get("news/"+featuredID, 200)
	// The publishing window hides an article outside it; priority orders the
	// list; an end before the start and an out-of-range display time fail.
	past, future := time.Now().Add(-48*time.Hour).UTC(), time.Now().Add(48*time.Hour).UTC()
	write("POST", "news", map[string]any{"title": "Bad window", "summary": "Summary", "body": "Body", "startsAt": future, "endsAt": past}, 422)
	write("POST", "news", map[string]any{"title": "Too long", "summary": "Summary", "body": "Body", "displaySeconds": 31}, 422)
	newsInput["title"], newsInput["showOnHome"], newsInput["endsAt"] = "Expired", false, past
	decode(write("POST", "news", newsInput, 201), &article)
	get("news/"+article.Article.ID, 404)
	if article.Article.DisplaySeconds != 6 || article.Article.SortOrder != 100 {
		t.Fatalf("schedule defaults: %+v", article.Article)
	}
	delete(newsInput, "endsAt")
	newsInput["title"], newsInput["sortOrder"], newsInput["displaySeconds"] = "Pinned", 0, 10
	decode(write("POST", "news", newsInput, 201), &article)
	decode(get("news", 200), &list)
	if list.Items[0].ID != article.Article.ID || list.Items[0].DisplaySeconds != 10 {
		t.Fatalf("priority ignored: %+v", list.Items)
	}
	write("DELETE", "news/"+article.Article.ID, nil, 204)
	delete(newsInput, "sortOrder")
	delete(newsInput, "displaySeconds")
	adInput["startsAt"] = future
	write("PUT", "ads/"+ad.Advertisement.ID, adInput, 200)
	decode(get("home", 200), &home)
	if len(home.Advertisements) != 0 {
		t.Fatal("scheduled advertisement shown early")
	}
	delete(adInput, "startsAt")
	adInput["active"] = false
	write("PUT", "ads/"+ad.Advertisement.ID, adInput, 200)
	decode(get("home", 200), &home)
	if len(home.Advertisements) != 0 {
		t.Fatal("inactive advertisement leaked")
	}
	call(publicHandler, "GET", "/v1/content/images/"+imageID, "", "", "", nil, 404)
	db.Reconnect(t)
	service = application.New(data.New(db.DB))
	if stored, err := service.Article(ctx, featuredID, false); err != nil || stored.ShowOnHome {
		t.Fatalf("content did not persist: %+v %v", stored, err)
	}
	// Rebuild handlers around the new pool before checking deletion.
	adminHandler = admintransport.New(authapp.New(authdata.New(db.DB), time.Hour), adminapp.New(admindata.New(db.DB)), browser, transport.NewAdmin(service))
	write("DELETE", "news/"+draftID, nil, 204)
	if _, err := service.Article(ctx, draftID, true); err == nil {
		t.Fatal("deleted article remained")
	}
}
