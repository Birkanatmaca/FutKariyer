package transport

import (
	"encoding/json"
	"net/http"
	"strconv"

	"futcareer/backend/internal/dashboard/application"
	"futcareer/backend/internal/platform/logging"
)

// NewAdmin serves GET /v1/admin/dashboard?days=7|30|90 behind the admin
// session check.
func NewAdmin(service *application.Service) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/admin/dashboard", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		days, _ := strconv.Atoi(r.URL.Query().Get("days"))
		out, err := service.Dashboard(r.Context(), days)
		if err != nil {
			logging.Fail(w, "dashboard.failed", err)
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": "internal_error", "message": "Ana sayfa yüklenemedi. Biraz sonra tekrar dene."}})
			return
		}
		_ = json.NewEncoder(w).Encode(out)
	})
	return mux
}
