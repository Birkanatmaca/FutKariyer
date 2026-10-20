package transport

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/platform/logging"
	"futcareer/backend/internal/pro/application"
	"futcareer/backend/internal/pro/domain"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
}

// New serves the signed-in account's Pro status and the Pro-only private browsing setting.
func New(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{auth: authService, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/me/pro", h.status)
	mux.HandleFunc("PUT /v1/me/pro/settings", h.settings)
	return secure(mux)
}

// NewAdmin lets administrators inspect, grant (+30 days, +3 rights once) or revoke Pro for testing.
func NewAdmin(service *application.Service) http.Handler {
	h := &Handler{service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/admin/users/{id}/pro", h.adminStatus)
	mux.HandleFunc("POST /v1/admin/users/{id}/pro", h.adminChange)
	return secure(mux)
}

func secure(mux *http.ServeMux) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		mux.ServeHTTP(w, r)
	})
}

func write(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func failure(w http.ResponseWriter, err error) {
	code, status, message := "internal_error", 500, "Pro üyelik bilgisi yüklenemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		code, status, message = "unauthorized", 401, "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrProRequired):
		code, status, message = "pro_required", 403, "Bu ayar Pro üyelere açık."
	case errors.Is(err, domain.ErrNotEligible):
		code, status, message = "not_eligible", 422, "Pro üyelik yalnızca sporcu, kulüp ve antrenör hesaplarına verilebilir."
	case errors.Is(err, domain.ErrNotFound):
		code, status, message = "not_found", 404, "Hesap bulunamadı."
	case errors.As(err, &fields):
		code, status, message = "validation_error", 422, fields.Error()
	default:
		logging.Fail(w, "pro.failed", err)
	}
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}

func decode(w http.ResponseWriter, r *http.Request, value any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	return strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") && decoder.Decode(value) == nil && decoder.Decode(&struct{}{}) == io.EOF
}

func (h *Handler) viewer(w http.ResponseWriter, r *http.Request) (application.Viewer, bool) {
	parts := strings.Fields(r.Header.Get("Authorization"))
	token := ""
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		token = parts[1]
	}
	user, err := h.auth.Me(r.Context(), token)
	if err != nil {
		failure(w, err)
		return application.Viewer{}, false
	}
	return application.Viewer{ID: user.ID, Role: user.Role}, true
}

func (h *Handler) status(w http.ResponseWriter, r *http.Request) {
	viewer, ok := h.viewer(w, r)
	if !ok {
		return
	}
	status, err := h.service.Status(r.Context(), viewer)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"pro": status, "eligible": domain.EligibleRole(viewer.Role)})
}

func (h *Handler) settings(w http.ResponseWriter, r *http.Request) {
	viewer, ok := h.viewer(w, r)
	if !ok {
		return
	}
	var input struct {
		PrivateBrowsing *bool `json:"privateBrowsing"`
	}
	if !decode(w, r, &input) || input.PrivateBrowsing == nil {
		failure(w, auth.ValidationError{"privateBrowsing": "Gizli gezinme tercihini gönder."})
		return
	}
	status, err := h.service.SetPrivateBrowsing(r.Context(), viewer, *input.PrivateBrowsing)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"pro": status})
}

func (h *Handler) adminStatus(w http.ResponseWriter, r *http.Request) {
	status, err := h.service.AdminStatus(r.Context(), r.PathValue("id"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"pro": status})
}

func (h *Handler) adminChange(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Action string `json:"action"`
	}
	if !decode(w, r, &input) || (input.Action != "grant" && input.Action != "revoke") {
		failure(w, auth.ValidationError{"action": "İşlem grant veya revoke olmalı."})
		return
	}
	var status domain.Status
	var err error
	if input.Action == "grant" {
		status, err = h.service.Grant(r.Context(), r.PathValue("id"))
	} else {
		status, err = h.service.Revoke(r.Context(), r.PathValue("id"))
	}
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"pro": status})
}
