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
	"futcareer/backend/internal/coaches/application"
	"futcareer/backend/internal/coaches/domain"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
}

// New serves coach profiles, club technical staff and the coach's clubs.
func New(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{auth: authService, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/me/coach-profile", h.ownProfile)
	mux.HandleFunc("PUT /v1/me/coach-profile", h.saveProfile)
	mux.HandleFunc("GET /v1/me/staff", h.staff)
	mux.HandleFunc("GET /v1/me/staff/candidates", h.candidates)
	mux.HandleFunc("POST /v1/me/staff", h.invite)
	mux.HandleFunc("PUT /v1/me/staff/{coachId}", h.update)
	mux.HandleFunc("DELETE /v1/me/staff/{coachId}", h.remove)
	mux.HandleFunc("GET /v1/me/coach-clubs", h.memberships)
	mux.HandleFunc("PUT /v1/me/coach-clubs/{clubId}", h.respond)
	mux.HandleFunc("DELETE /v1/me/coach-clubs/{clubId}", h.leave)
	mux.HandleFunc("GET /v1/staff/clubs/{clubId}", h.publicStaff)
	mux.HandleFunc("GET /v1/staff/coaches/{coachId}", h.publicCoach)
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

func writeError(w http.ResponseWriter, status int, code, message string, fields any) {
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}

func failure(w http.ResponseWriter, err error) {
	var fields domain.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		writeError(w, 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap.", nil)
	case errors.Is(err, domain.ErrNotFound):
		writeError(w, 404, "not_found", "Kayıt bulunamadı.", nil)
	case errors.Is(err, domain.ErrExists):
		writeError(w, 409, "already_staff", "Bu antrenör zaten teknik ekibinde ya da davetli.", nil)
	case errors.Is(err, domain.ErrStaffLimit):
		writeError(w, 422, "staff_limit", "Teknik ekibe en fazla 20 antrenör ekleyebilirsin.", nil)
	case errors.As(err, &fields):
		writeError(w, 422, "validation_error", fields.Error(), fields)
	default:
		slog.Error("coach request failed", "error", err)
		writeError(w, 500, "internal_error", "İşlem tamamlanamadı. Biraz sonra tekrar dene.", nil)
	}
}

func forbidden(w http.ResponseWriter, message string) {
	writeError(w, 403, "forbidden", message, nil)
}

func bearer(r *http.Request) string {
	parts := strings.Fields(r.Header.Get("Authorization"))
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		return parts[1]
	}
	return ""
}

func (h *Handler) viewer(w http.ResponseWriter, r *http.Request) (auth.PublicUser, bool) {
	u, err := h.auth.Me(r.Context(), bearer(r))
	if err != nil {
		failure(w, err)
		return u, false
	}
	return u, true
}

// coach accepts only a coach's own session.
func (h *Handler) coach(w http.ResponseWriter, r *http.Request) (string, bool) {
	u, ok := h.viewer(w, r)
	if !ok {
		return "", false
	}
	if u.Role != "coach" || u.Delegate != nil {
		forbidden(w, "Bu alan yalnızca antrenör hesaplarına açık.")
		return "", false
	}
	return u.ID, true
}

// club accepts only the club's own session: a switched coach never manages
// the technical staff.
func (h *Handler) club(w http.ResponseWriter, r *http.Request) (string, bool) {
	u, ok := h.viewer(w, r)
	if !ok {
		return "", false
	}
	if u.Role != "club" {
		forbidden(w, "Bu alan yalnızca kulüp hesaplarına açık.")
		return "", false
	}
	if u.Delegate != nil {
		forbidden(w, "Teknik ekibi yalnızca kulüp hesabının sahibi yönetebilir.")
		return "", false
	}
	return u.ID, true
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		writeError(w, 415, "invalid_content_type", "JSON içerik türü gerekli.", nil)
		return false
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16384))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(v); err != nil {
		writeError(w, 400, "invalid_request", "İstek bilgileri okunamadı.", nil)
		return false
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		writeError(w, 400, "invalid_request", "İstek bilgileri okunamadı.", nil)
		return false
	}
	return true
}

func (h *Handler) ownProfile(w http.ResponseWriter, r *http.Request) {
	id, ok := h.coach(w, r)
	if !ok {
		return
	}
	profile, err := h.service.Profile(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"profile": profile})
}

func (h *Handler) saveProfile(w http.ResponseWriter, r *http.Request) {
	id, ok := h.coach(w, r)
	if !ok {
		return
	}
	var in domain.Profile
	if !decode(w, r, &in) {
		return
	}
	profile, err := h.service.SaveProfile(r.Context(), id, in)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"profile": profile})
}

func (h *Handler) staff(w http.ResponseWriter, r *http.Request) {
	id, ok := h.club(w, r)
	if !ok {
		return
	}
	members, err := h.service.Staff(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"staff": members, "limit": domain.MaxStaff})
}

func (h *Handler) candidates(w http.ResponseWriter, r *http.Request) {
	id, ok := h.club(w, r)
	if !ok {
		return
	}
	items, err := h.service.Candidates(r.Context(), id, r.URL.Query().Get("q"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"items": items})
}

type grant struct {
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
}

func (h *Handler) invite(w http.ResponseWriter, r *http.Request) {
	id, ok := h.club(w, r)
	if !ok {
		return
	}
	var in struct {
		CoachID string `json:"coachId"`
		grant
	}
	if !decode(w, r, &in) {
		return
	}
	if err := h.service.Invite(r.Context(), id, strings.TrimSpace(in.CoachID), in.Role, in.Permissions); err != nil {
		failure(w, err)
		return
	}
	h.staff(w, r)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id, ok := h.club(w, r)
	if !ok {
		return
	}
	var in grant
	if !decode(w, r, &in) {
		return
	}
	if err := h.service.Update(r.Context(), id, r.PathValue("coachId"), in.Role, in.Permissions); err != nil {
		failure(w, err)
		return
	}
	h.staff(w, r)
}

func (h *Handler) remove(w http.ResponseWriter, r *http.Request) {
	id, ok := h.club(w, r)
	if !ok {
		return
	}
	if err := h.service.Remove(r.Context(), id, r.PathValue("coachId")); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) memberships(w http.ResponseWriter, r *http.Request) {
	id, ok := h.coach(w, r)
	if !ok {
		return
	}
	items, err := h.service.Memberships(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"clubs": items})
}

func (h *Handler) respond(w http.ResponseWriter, r *http.Request) {
	id, ok := h.coach(w, r)
	if !ok {
		return
	}
	var in struct {
		Accept bool `json:"accept"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err := h.service.Respond(r.Context(), id, r.PathValue("clubId"), in.Accept); err != nil {
		failure(w, err)
		return
	}
	h.memberships(w, r)
}

func (h *Handler) leave(w http.ResponseWriter, r *http.Request) {
	id, ok := h.coach(w, r)
	if !ok {
		return
	}
	if err := h.service.Leave(r.Context(), id, r.PathValue("clubId")); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) publicStaff(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.viewer(w, r); !ok {
		return
	}
	items, err := h.service.PublicStaff(r.Context(), r.PathValue("clubId"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"staff": items})
}

func (h *Handler) publicCoach(w http.ResponseWriter, r *http.Request) {
	u, ok := h.viewer(w, r)
	if !ok {
		return
	}
	card, err := h.service.PublicCoach(r.Context(), r.PathValue("coachId"), u.ID, u.Role)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, card)
}
