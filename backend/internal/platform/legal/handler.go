// Package legal serves the privacy policy, terms of use and KVKK notice
// (23 Oct 2026). The app links to these pages and the stores need their
// addresses. Company details are placeholders until the owner fills them in.
package legal

import (
	"embed"
	"net/http"
)

//go:embed pages/*.html
var pages embed.FS

// Paths maps each public address to its page.
var Paths = map[string]string{
	"/gizlilik":          "pages/privacy.html",
	"/kullanim-sartlari": "pages/terms.html",
	"/kvkk":              "pages/kvkk.html",
}

// New serves one embedded page per path.
func New() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		file, ok := Paths[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		body, err := pages.ReadFile(file)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'")
		w.Header().Set("Cache-Control", "public, max-age=3600")
		_, _ = w.Write(body)
	})
}
