package transport

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/clubs/application"
	"futcareer/backend/internal/clubs/domain"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
}

func New(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{auth: authService, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/me/club-profile", h.get)
	mux.HandleFunc("PUT /v1/me/club-profile", h.update)
	mux.HandleFunc("GET /v1/me/club-center", h.center)
	mux.HandleFunc("GET /v1/me/squad", h.squad)
	mux.HandleFunc("DELETE /v1/me/squad/{playerId}", h.removeMember)
	mux.HandleFunc("GET /v1/me/memberships", h.memberships)
	mux.HandleFunc("DELETE /v1/me/memberships/{clubId}", h.leaveClub)
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
	status, code, message := 500, "internal_error", "Kulüp profili yüklenemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "not_found", "Kulüp profili bulunamadı."
	case errors.Is(err, domain.ErrNotMember):
		status, code, message = 404, "not_member", "Bu oyuncu kadroda değil."
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", fields.Error()
	default:
		slog.Error("club profile failed", "error", err)
	}
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}

func (h *Handler) actor(w http.ResponseWriter, r *http.Request) (string, bool) {
	parts := strings.Fields(r.Header.Get("Authorization"))
	token := ""
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		token = parts[1]
	}
	u, err := h.auth.Me(r.Context(), token)
	if err != nil {
		failure(w, err)
		return "", false
	}
	if u.Role != "club" {
		write(w, 403, map[string]any{"error": map[string]any{"code": "forbidden", "message": "Bu alan yalnızca kulüp hesaplarına açık.", "fields": nil}})
		return "", false
	}
	return u.ID, true
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	p, err := h.service.Profile(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, p)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		failure(w, auth.ValidationError{"profile": "JSON biçiminde profil gönder."})
		return
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	decoder.DisallowUnknownFields()
	var in application.ProfileInput
	if err := decoder.Decode(&in); err != nil || decoder.Decode(&struct{}{}) != io.EOF {
		failure(w, auth.ValidationError{"profile": "Geçerli bir profil gönder."})
		return
	}
	p, err := h.service.UpdateProfile(r.Context(), id, in)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, p)
}

func (h *Handler) center(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	c, err := h.service.Center(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, c)
}

// NewAdmin serves one club's administrator overview. Mounted behind the admin session check.
func NewAdmin(service *application.Service) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/admin/club-overviews/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if len(id) != 32 {
			failure(w, auth.ValidationError{"club": "Geçerli bir kulüp seç."})
			return
		}
		out, err := service.Overview(r.Context(), id)
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		mux.ServeHTTP(w, r)
	})
}

// player resolves an active player account for membership endpoints.
func (h *Handler) player(w http.ResponseWriter, r *http.Request) (string, bool) {
	parts := strings.Fields(r.Header.Get("Authorization"))
	token := ""
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		token = parts[1]
	}
	u, err := h.auth.Me(r.Context(), token)
	if err != nil {
		failure(w, err)
		return "", false
	}
	if u.Role != "player" {
		write(w, 403, map[string]any{"error": map[string]any{"code": "forbidden", "message": "Bu alan yalnızca sporcu hesaplarına açık.", "fields": nil}})
		return "", false
	}
	return u.ID, true
}

func (h *Handler) squad(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	items, err := h.service.Squad(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"items": items})
}

func (h *Handler) removeMember(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	if err := h.service.RemoveMember(r.Context(), id, r.PathValue("playerId")); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(204)
}

func (h *Handler) memberships(w http.ResponseWriter, r *http.Request) {
	id, ok := h.player(w, r)
	if !ok {
		return
	}
	items, err := h.service.Memberships(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"items": items})
}

func (h *Handler) leaveClub(w http.ResponseWriter, r *http.Request) {
	id, ok := h.player(w, r)
	if !ok {
		return
	}
	if err := h.service.RemoveMember(r.Context(), r.PathValue("clubId"), id); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(204)
}
