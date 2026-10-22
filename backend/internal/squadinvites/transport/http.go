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
	"futcareer/backend/internal/squadinvites/application"
	"futcareer/backend/internal/squadinvites/domain"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
}

func New(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{auth: authService, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/me/squad/candidates", h.candidates)
	mux.HandleFunc("GET /v1/me/squad/invites", h.clubInvites)
	mux.HandleFunc("POST /v1/me/squad/invites", h.invite)
	mux.HandleFunc("DELETE /v1/me/squad/invites/{id}", h.cancel)
	mux.HandleFunc("GET /v1/me/squad-invites", h.playerInvites)
	mux.HandleFunc("PUT /v1/me/squad-invites/{id}", h.respond)
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
	status, code, message := 500, "internal_error", "Kadro davetleri yüklenemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, errForbidden):
		status, code, message = 403, "forbidden", "Bu işlem hesabına açık değil."
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "not_found", "Davet bulunamadı."
	case errors.Is(err, domain.ErrNotInvitable):
		status, code, message = 409, "not_invitable", "Bu oyuncu davet edilemez. Zaten kadronda olabilir veya açık bir davetin olabilir."
	case errors.Is(err, domain.ErrLimit):
		status, code, message = 409, "limit", "En fazla 50 yanıtlanmamış davetin olabilir."
	case errors.Is(err, domain.ErrInvalidState):
		status, code, message = 409, "invalid_state", "Bu davet artık açık değil. Listeyi yenile."
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", fields.Error()
	default:
		logging.Fail(w, "squad_invite.failed", err)
	}
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}

var errForbidden = errors.New("forbidden")

func (h *Handler) actor(w http.ResponseWriter, r *http.Request, role string) (string, bool) {
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
	if u.Role != role {
		failure(w, errForbidden)
		return "", false
	}
	return u.ID, true
}

func decode(w http.ResponseWriter, r *http.Request, out any) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		failure(w, auth.ValidationError{"request": "JSON biçiminde istek gönder."})
		return false
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	d.DisallowUnknownFields()
	if d.Decode(out) != nil || d.Decode(&struct{}{}) != io.EOF {
		failure(w, auth.ValidationError{"request": "Geçerli bir istek gönder."})
		return false
	}
	return true
}

func (h *Handler) candidates(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "club")
	if !ok {
		return
	}
	out, err := h.service.Candidates(r.Context(), id, r.URL.Query().Get("q"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"items": out})
}

func (h *Handler) clubInvites(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "club")
	if !ok {
		return
	}
	out, err := h.service.ClubInvites(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"items": out})
}

func (h *Handler) invite(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "club")
	if !ok {
		return
	}
	var in struct {
		PlayerID string `json:"playerId"`
		Message  string `json:"message"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.Invite(r.Context(), id, in.PlayerID, in.Message)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, map[string]any{"invite": out})
}

func (h *Handler) cancel(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "club")
	if !ok {
		return
	}
	out, err := h.service.Cancel(r.Context(), id, r.PathValue("id"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"invite": out})
}

func (h *Handler) playerInvites(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "player")
	if !ok {
		return
	}
	out, err := h.service.PlayerInvites(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"items": out})
}

func (h *Handler) respond(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "player")
	if !ok {
		return
	}
	var in struct {
		Decision string `json:"decision"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.Respond(r.Context(), id, r.PathValue("id"), in.Decision)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"invite": out})
}
