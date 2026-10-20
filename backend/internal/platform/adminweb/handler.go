package adminweb

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Panel routes that load the single-page app directly (same list as
// frontend/src/app/useAdminRoute.ts).
var sections = map[string]bool{
	"users": true, "clubs": true, "applications": true, "reports": true, "ads": true, "popups": true, "news": true,
	"leagues": true, "payments": true, "gifts": true, "rating": true, "announcements": true,
}
var clubOverview = regexp.MustCompile(`^/securityadmin/clubs/[0-9a-f]{32}$`)

// New serves only the admin app's entry routes and built public assets.
func New(directory string) (http.Handler, error) {
	root, err := filepath.Abs(directory)
	if err != nil {
		return nil, err
	}
	index := filepath.Join(root, "index.html")
	stat, err := os.Stat(index)
	if err != nil || stat.IsDir() {
		return nil, fmt.Errorf("ADMIN_FRONTEND_DIR must contain the built frontend index.html")
	}
	assets := http.StripPrefix("/securityadmin/assets/", http.FileServer(http.Dir(filepath.Join(root, "assets"))))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'")
		if strings.HasPrefix(r.URL.Path, "/securityadmin/assets/") {
			assets.ServeHTTP(w, r)
			return
		}
		if r.URL.Path == "/securityadmin" || r.URL.Path == "/securityadmin/" || sections[strings.TrimPrefix(r.URL.Path, "/securityadmin/")] || clubOverview.MatchString(r.URL.Path) {
			w.Header().Set("Cache-Control", "no-store")
			http.ServeFile(w, r, index)
			return
		}
		http.NotFound(w, r)
	}), nil
}
