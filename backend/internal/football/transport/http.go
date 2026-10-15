package transport

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/football/application"
	"futcareer/backend/internal/football/domain"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
}

func New(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{auth: authService, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/football/competitions", h.catalog)
	mux.HandleFunc("GET /v1/football/competitions/{slug}/standings", h.standings)
	mux.HandleFunc("GET /v1/football/competitions/{slug}/live", h.live)
	mux.HandleFunc("GET /v1/football/competitions/{slug}/results", h.results)
	mux.HandleFunc("GET /v1/football/competitions/{slug}/stats", h.stats)
	mux.HandleFunc("GET /v1/football/ankara", h.ankara)
	mux.HandleFunc("GET /v1/football/ankara/bulletin", h.ankaraBulletin)
	mux.HandleFunc("GET /v1/football/ankara/posts", h.ankaraPosts)
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
	status, code, message := 500, "internal_error", "Lig verileri yüklenemedi. Biraz sonra tekrar dene."
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrUnknownCompetition):
		status, code, message = 404, "not_found", "Lig bulunamadı."
	case errors.Is(err, domain.ErrInvalidSelection):
		status, code, message = 422, "validation_error", "Sezon, lig veya grup seçimi geçersiz."
	case errors.Is(err, domain.ErrUpstream):
		status, code, message = 502, "upstream_unavailable", "Lig verileri şu anda alınamıyor. Biraz sonra tekrar dene."
		slog.Warn("football upstream failed", "error", err)
	default:
		slog.Error("football operation failed", "error", err)
	}
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": nil}})
}

// signedIn keeps the endpoints for app users so the upstream sources are not proxied for the whole internet.
func (h *Handler) signedIn(w http.ResponseWriter, r *http.Request) bool {
	parts := strings.Fields(r.Header.Get("Authorization"))
	token := ""
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		token = parts[1]
	}
	if _, err := h.auth.Me(r.Context(), token); err != nil {
		failure(w, err)
		return false
	}
	return true
}

func (h *Handler) catalog(w http.ResponseWriter, r *http.Request) {
	if h.signedIn(w, r) {
		write(w, 200, h.service.Catalog())
	}
}

func (h *Handler) standings(w http.ResponseWriter, r *http.Request) {
	if !h.signedIn(w, r) {
		return
	}
	out, err := h.service.Standings(r.Context(), r.PathValue("slug"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, out)
}

func (h *Handler) live(w http.ResponseWriter, r *http.Request) {
	if !h.signedIn(w, r) {
		return
	}
	out, err := h.service.Live(r.Context(), r.PathValue("slug"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, out)
}

func (h *Handler) results(w http.ResponseWriter, r *http.Request) {
	if !h.signedIn(w, r) {
		return
	}
	out, err := h.service.Results(r.Context(), r.PathValue("slug"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, out)
}

func (h *Handler) stats(w http.ResponseWriter, r *http.Request) {
	if !h.signedIn(w, r) {
		return
	}
	out, err := h.service.Stats(r.Context(), r.PathValue("slug"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, out)
}

func (h *Handler) ankara(w http.ResponseWriter, r *http.Request) {
	if !h.signedIn(w, r) {
		return
	}
	q := r.URL.Query()
	out, err := h.service.Ankara(r.Context(), q.Get("season"), q.Get("league"), q.Get("group"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, out)
}

func (h *Handler) ankaraBulletin(w http.ResponseWriter, r *http.Request) {
	if !h.signedIn(w, r) {
		return
	}
	out, err := h.service.AnkaraBulletin(r.Context())
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, out)
}

func (h *Handler) ankaraPosts(w http.ResponseWriter, r *http.Request) {
	if !h.signedIn(w, r) {
		return
	}
	page := 1
	if v := r.URL.Query().Get("page"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			failure(w, domain.ErrInvalidSelection)
			return
		}
		page = n
	}
	out, err := h.service.AnkaraPosts(r.Context(), page)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, out)
}
