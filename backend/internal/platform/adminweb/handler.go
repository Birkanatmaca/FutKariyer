package adminweb

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

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
		switch r.URL.Path {
		case "/securityadmin", "/securityadmin/", "/securityadmin/users", "/securityadmin/clubs":
			w.Header().Set("Cache-Control", "no-store")
			http.ServeFile(w, r, index)
		default:
			http.NotFound(w, r)
		}
	}), nil
}
