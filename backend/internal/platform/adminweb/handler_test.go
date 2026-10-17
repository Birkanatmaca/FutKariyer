package adminweb_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"futcareer/backend/internal/platform/adminweb"
)

func TestPanelRoutesLoadTheAppDirectly(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html></html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	handler, err := adminweb.New(dir)
	if err != nil {
		t.Fatal(err)
	}
	for path, want := range map[string]int{
		"/securityadmin":        200,
		"/securityadmin/rating": 200,
		"/securityadmin/gifts":  200,
		"/securityadmin/clubs/" + "0123456789abcdef0123456789abcdef": 200,
		"/securityadmin/unknown":                                     404,
		"/securityadmin/clubs/../x":                                  404,
	} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != want {
			t.Fatalf("%s: got %d, want %d", path, rec.Code, want)
		}
	}
}
