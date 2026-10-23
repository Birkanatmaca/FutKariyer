package legal_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"futcareer/backend/internal/platform/legal"
)

func TestPagesAreServed(t *testing.T) {
	h := legal.New()
	for path := range legal.Paths {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != 200 || !strings.Contains(rec.Body.String(), "Fut Career") {
			t.Fatalf("%s: %d", path, rec.Code)
		}
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/yok", nil))
	if rec.Code != 404 {
		t.Fatal("unknown page served")
	}
}
