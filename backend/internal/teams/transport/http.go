package transport

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/platform/logging"
	"futcareer/backend/internal/teams/application"
	"futcareer/backend/internal/teams/domain"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
}

func New(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{auth: authService, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/teams", h.list)
	mux.HandleFunc("GET /v1/teams/{id}", h.get)
	mux.HandleFunc("POST /v1/teams/{id}/join-requests", h.request)
	mux.HandleFunc("GET /v1/teams/me/join-requests", h.requests)
	mux.HandleFunc("PUT /v1/teams/me/join-requests/{id}", h.decide)
	mux.HandleFunc("GET /v1/me/team-join-requests", h.playerRequests)
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
	code, status, message := "internal_error", 500, "Takım işlemi tamamlanamadı. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		code, status, message = "unauthorized", 401, "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrNotFound):
		code, status, message = "not_found", 404, "Takım veya başvuru bulunamadı."
	case errors.Is(err, domain.ErrForbidden):
		code, status, message = "forbidden", 403, "Bu işlem hesabına açık değil."
	case errors.Is(err, domain.ErrQuotaExhausted):
		code, status, message = "quota_exhausted", 409, "Kullanılabilir takım başvuru hakkın kalmadı."
	case errors.Is(err, domain.ErrDuplicate):
		code, status, message = "duplicate_request", 409, "Bu takıma daha önce başvuru gönderdin."
	case errors.Is(err, domain.ErrRequestClosed):
		code, status, message = "request_closed", 409, "Bu başvuru daha önce sonuçlandırılmış."
	case errors.As(err, &fields):
		code, status, message = "validation_error", 422, fields.Error()
	default:
		logging.Fail(w, "team.failed", err)
	}
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}

func (h *Handler) viewer(w http.ResponseWriter, r *http.Request) (application.Viewer, bool) {
	parts := strings.Fields(r.Header.Get("Authorization"))
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		failure(w, authdomain.ErrUnauthorized)
		return application.Viewer{}, false
	}
	user, err := h.auth.Me(r.Context(), parts[1])
	if err != nil {
		failure(w, err)
		return application.Viewer{}, false
	}
	return application.Viewer{ID: user.ID, Role: user.Role}, true
}

func pageNumber(r *http.Request, key string, fallback int) int {
	value, ok := r.URL.Query()[key]
	if !ok {
		return fallback
	}
	if len(value) != 1 {
		return 0
	}
	result, err := strconv.Atoi(value[0])
	if err != nil {
		return 0
	}
	return result
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	viewer, ok := h.viewer(w, r)
	if !ok {
		return
	}
	query := r.URL.Query()
	page, err := h.service.List(r.Context(), domain.Query{ViewerID: viewer.ID, Search: query.Get("search"), Page: pageNumber(r, "page", 1), PageSize: pageNumber(r, "pageSize", 20)})
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, page)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	viewer, ok := h.viewer(w, r)
	if !ok {
		return
	}
	result, err := h.service.Get(r.Context(), viewer, r.PathValue("id"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, result)
}

func (h *Handler) request(w http.ResponseWriter, r *http.Request) {
	viewer, ok := h.viewer(w, r)
	if !ok {
		return
	}
	body, bodyErr := io.ReadAll(http.MaxBytesReader(w, r.Body, 1))
	if bodyErr != nil || len(body) != 0 {
		failure(w, auth.ValidationError{"request": "Başvuru gövdesi boş olmalı."})
		return
	}
	item, quota, err := h.service.Request(r.Context(), viewer, r.PathValue("id"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, map[string]any{"request": item, "quota": quota})
}

func (h *Handler) requests(w http.ResponseWriter, r *http.Request) {
	viewer, ok := h.viewer(w, r)
	if !ok {
		return
	}
	page, err := h.service.Requests(r.Context(), viewer, r.URL.Query().Get("status"), pageNumber(r, "page", 1), pageNumber(r, "pageSize", 20))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, page)
}

func (h *Handler) playerRequests(w http.ResponseWriter, r *http.Request) {
	viewer, ok := h.viewer(w, r)
	if !ok {
		return
	}
	page, err := h.service.PlayerRequests(r.Context(), viewer, pageNumber(r, "page", 1), pageNumber(r, "pageSize", 20))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, page)
}

func (h *Handler) decide(w http.ResponseWriter, r *http.Request) {
	viewer, ok := h.viewer(w, r)
	if !ok {
		return
	}
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		failure(w, auth.ValidationError{"decision": "JSON biçiminde kabul veya ret seçimi gerekli."})
		return
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	var input struct {
		Decision string `json:"decision"`
	}
	if err := decoder.Decode(&input); err != nil {
		failure(w, auth.ValidationError{"decision": "Başvuruyu kabul et veya reddet."})
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		failure(w, auth.ValidationError{"decision": "Tek bir karar gönder."})
		return
	}
	item, err := h.service.Decide(r.Context(), viewer, r.PathValue("id"), input.Decision)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"request": item})
}
