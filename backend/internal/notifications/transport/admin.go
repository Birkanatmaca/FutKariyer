package transport

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/notifications/application"
	"futcareer/backend/internal/notifications/domain"
	"futcareer/backend/internal/platform/logging"
)

// NewAdmin serves opportunity announcements. It is mounted behind the admin session check.
func NewAdmin(service *application.AnnouncementService) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/admin/announcements", func(w http.ResponseWriter, r *http.Request) {
		items, err := service.List(r.Context())
		if err != nil {
			adminFailure(w, err)
			return
		}
		write(w, 200, map[string]any{"items": items})
	})
	mux.HandleFunc("POST /v1/admin/announcements", func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			adminFailure(w, auth.ValidationError{"announcement": "JSON biçiminde duyuru gönder."})
			return
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
		decoder.DisallowUnknownFields()
		var input application.AnnouncementInput
		if err := decoder.Decode(&input); err != nil || decoder.Decode(&struct{}{}) != io.EOF {
			adminFailure(w, auth.ValidationError{"announcement": "Geçerli bir duyuru gönder."})
			return
		}
		item, err := service.Create(r.Context(), input)
		if err != nil {
			adminFailure(w, err)
			return
		}
		write(w, 201, item)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		mux.ServeHTTP(w, r)
	})
}

func adminFailure(w http.ResponseWriter, err error) {
	status, code, message := 500, "internal_error", "Duyuru gönderilemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, domain.ErrNoRecipient):
		status, code, message = 422, "no_recipient", "Duyuru için aktif alıcı bulunamadı."
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", fields.Error()
	default:
		logging.Fail(w, "announcement.failed", err)
	}
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}
