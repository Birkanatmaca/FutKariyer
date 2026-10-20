package transport

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	authapplication "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/platform/logging"
	playerapplication "futcareer/backend/internal/players/application"
)

type Handler struct {
	auth    *authapplication.Service
	players *playerapplication.Service
}

// New serves the player's own profile and, when a media service is given, the
// profile gallery.
func New(auth *authapplication.Service, players *playerapplication.Service, gallery ...*playerapplication.MediaService) http.Handler {
	h := &Handler{auth: auth, players: players}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/players/me/profile", h.get)
	mux.HandleFunc("PUT /v1/players/me/profile", h.save)
	if len(gallery) > 0 && gallery[0] != nil {
		registerMedia(mux, auth, gallery[0])
	}
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

func decode(w http.ResponseWriter, r *http.Request, value any) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		writeError(w, 415, "invalid_content_type", "JSON içerik türü gerekli.", nil)
		return false
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16384))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		writeError(w, 400, "invalid_request", "İstek bilgileri okunamadı.", nil)
		return false
	}
	if decoder.Decode(&struct{}{}) != io.EOF {
		writeError(w, 400, "invalid_request", "İstek bilgileri okunamadı.", nil)
		return false
	}
	return true
}

func bearer(r *http.Request) string {
	parts := strings.Fields(r.Header.Get("Authorization"))
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		return parts[1]
	}
	return ""
}

func (h *Handler) player(w http.ResponseWriter, r *http.Request) (authapplication.PublicUser, bool) {
	user, err := h.auth.Me(r.Context(), bearer(r))
	if errors.Is(err, authdomain.ErrUnauthorized) {
		writeError(w, 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap.", nil)
		return authapplication.PublicUser{}, false
	}
	if err != nil {
		logging.Fail(w, "player.auth.failed", err)
		writeError(w, 500, "internal_error", "İşlem tamamlanamadı. Biraz sonra tekrar dene.", nil)
		return authapplication.PublicUser{}, false
	}
	if user.Role != "player" {
		writeError(w, 403, "role_not_allowed", "Bu alan oyuncu hesapları için kullanılabilir.", nil)
		return authapplication.PublicUser{}, false
	}
	return user, true
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	user, ok := h.player(w, r)
	if !ok {
		return
	}
	profile, err := h.players.Get(r.Context(), user.ID)
	if err != nil {
		logging.Fail(w, "player.profile.load_failed", err)
		writeError(w, 500, "internal_error", "Profil bilgileri yüklenemedi. Biraz sonra tekrar dene.", nil)
		return
	}
	write(w, 200, map[string]any{"profile": profile})
}

func (h *Handler) save(w http.ResponseWriter, r *http.Request) {
	user, ok := h.player(w, r)
	if !ok {
		return
	}
	var in playerapplication.SaveInput
	if !decode(w, r, &in) {
		return
	}
	profile, err := h.players.Save(r.Context(), user.ID, in)
	if err != nil {
		var fields playerapplication.ValidationError
		if errors.As(err, &fields) {
			writeError(w, 422, "validation_error", fields.Error(), fields)
			return
		}
		logging.Fail(w, "player.profile.save_failed", err)
		writeError(w, 500, "internal_error", "Profil kaydedilemedi. Biraz sonra tekrar dene.", nil)
		return
	}
	write(w, 200, map[string]any{"profile": profile})
}
