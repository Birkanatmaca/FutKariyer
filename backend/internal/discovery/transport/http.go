package transport

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/discovery/application"
	"futcareer/backend/internal/discovery/domain"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
}

func New(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{auth: authService, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/discovery/{kind}", h.list)
	mux.HandleFunc("GET /v1/discovery/{kind}/{id}", h.get)
	mux.HandleFunc("PUT /v1/discovery/{kind}/{id}/follow", h.follow)
	mux.HandleFunc("GET /v1/me/insights", h.insights)
	mux.HandleFunc("GET /v1/me/profile-visitors", h.visitors)
	mux.HandleFunc("GET /v1/me/watchlist", h.watchlist)
	mux.HandleFunc("PUT /v1/me/watchlist/{playerId}", h.watch(true))
	mux.HandleFunc("DELETE /v1/me/watchlist/{playerId}", h.watch(false))
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
	code, status, message := "internal_error", 500, "Profiller yüklenemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		code, status, message = "unauthorized", 401, "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrVerificationRequired):
		code, status, message = "verification_required", 403, "Oyuncuları keşfetmek için hesabının yönetici tarafından doğrulanması gerekiyor."
	case errors.Is(err, domain.ErrForbidden):
		code, status, message = "forbidden", 403, "Bu keşif bölümü hesap türüne açık değil."
	case errors.Is(err, domain.ErrNotFound):
		code, status, message = "not_found", 404, "Bu profil artık keşifte görünmüyor."
	case errors.As(err, &fields):
		code, status, message = "validation_error", 422, fields.Error()
	default:
		slog.Error("discovery operation failed", "error", err)
	}
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}

func (h *Handler) viewer(w http.ResponseWriter, r *http.Request) (domain.Viewer, bool) {
	parts := strings.Fields(r.Header.Get("Authorization"))
	token := ""
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		token = parts[1]
	}
	user, err := h.auth.Me(r.Context(), token)
	if err != nil {
		failure(w, err)
		return domain.Viewer{}, false
	}
	return domain.Viewer{ID: user.ID, Role: user.Role, Verified: user.Verified}, true
}

func role(r *http.Request) string {
	return map[string]string{"players": "player", "clubs": "club", "coaches": "coach"}[r.PathValue("kind")]
}

func number(r *http.Request, key string, fallback int) int {
	if value, present := r.URL.Query()[key]; present {
		if len(value) != 1 {
			return 0
		}
		n, err := strconv.Atoi(value[0])
		if err != nil {
			return 0
		}
		return n
	}
	return fallback
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	viewer, ok := h.viewer(w, r)
	if !ok {
		return
	}
	query := r.URL.Query()
	result, err := h.service.List(r.Context(), viewer, domain.Query{Role: role(r), Search: query.Get("search"), Position: query.Get("position"), DominantFoot: query.Get("dominantFoot"), Availability: query.Get("availability"), FootballType: query.Get("footballType"), LicenseStatus: query.Get("licenseStatus"), Page: number(r, "page", 1), PageSize: number(r, "pageSize", 20)})
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, result)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	viewer, ok := h.viewer(w, r)
	if !ok {
		return
	}
	profile, err := h.service.Get(r.Context(), viewer, role(r), r.PathValue("id"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"profile": profile})
}
func (h *Handler) insights(w http.ResponseWriter, r *http.Request) {
	viewer, ok := h.viewer(w, r)
	if !ok {
		return
	}
	out, err := h.service.Insights(r.Context(), viewer)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, out)
}

// visitors is "who viewed your profile"; identities leave the server only for Pro owners
// (and for the single most recent non-private visitor of a free owner).
func (h *Handler) visitors(w http.ResponseWriter, r *http.Request) {
	viewer, ok := h.viewer(w, r)
	if !ok {
		return
	}
	out, err := h.service.Visitors(r.Context(), viewer)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, out)
}

// watchlist is the coach's İzleme listesi: starred players still in discovery.
func (h *Handler) watchlist(w http.ResponseWriter, r *http.Request) {
	viewer, ok := h.viewer(w, r)
	if !ok {
		return
	}
	items, err := h.service.Watchlist(r.Context(), viewer)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"items": items})
}

func (h *Handler) watch(on bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		viewer, ok := h.viewer(w, r)
		if !ok {
			return
		}
		if err := h.service.Watch(r.Context(), viewer, r.PathValue("playerId"), on); err != nil {
			failure(w, err)
			return
		}
		w.WriteHeader(204)
	}
}

func (h *Handler) follow(w http.ResponseWriter, r *http.Request) {
	viewer, ok := h.viewer(w, r)
	if !ok {
		return
	}
	var in struct {
		Following *bool `json:"following"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") || decoder.Decode(&in) != nil || in.Following == nil || decoder.Decode(&struct{}{}) != io.EOF {
		failure(w, auth.ValidationError{"following": "Geçerli bir takip tercihi gönder."})
		return
	}
	if err := h.service.Follow(r.Context(), viewer, role(r), r.PathValue("id"), *in.Following); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(204)
}
