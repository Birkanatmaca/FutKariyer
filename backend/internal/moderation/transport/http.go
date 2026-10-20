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
	"futcareer/backend/internal/moderation/application"
	"futcareer/backend/internal/moderation/domain"
	"futcareer/backend/internal/platform/logging"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
}

func headers(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}

// New serves reporting and blocking for signed-in mobile accounts.
func New(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{auth: authService, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/reports", h.report)
	mux.HandleFunc("GET /v1/me/blocks", h.blocks)
	mux.HandleFunc("PUT /v1/me/blocks/{userId}", h.block)
	mux.HandleFunc("DELETE /v1/me/blocks/{userId}", h.unblock)
	return headers(mux)
}

// NewAdmin serves the report review queue behind the admin session checks.
func NewAdmin(service *application.Service) http.Handler {
	h := &Handler{service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/admin/reports", h.reports)
	mux.HandleFunc("POST /v1/admin/reports/{id}/resolve", h.resolve)
	return headers(mux)
}

func write(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func failure(w http.ResponseWriter, err error) {
	status, code, message := 500, "internal_error", "İşlem tamamlanamadı. Biraz sonra tekrar dene."
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "not_found", "İçerik veya hesap bulunamadı."
	case errors.Is(err, domain.ErrForbidden):
		status, code, message = 403, "forbidden", "Bu işlem bu hesap için yapılamaz."
	case errors.Is(err, domain.ErrInvalid):
		status, code, message = 422, "validation_error", "Geçerli bir seçim yap."
	case errors.Is(err, domain.ErrDuplicate):
		status, code, message = 409, "already_reported", "Bunu zaten bildirdin. İnceleme sürüyor."
	case errors.Is(err, domain.ErrRateLimited):
		status, code, message = 429, "rate_limited", "Bugün çok fazla bildirim gönderdin. Yarın tekrar dene."
	case errors.Is(err, domain.ErrAlreadyFinal):
		status, code, message = 409, "already_resolved", "Bu bildirim zaten sonuçlandırıldı. Listeyi yenile."
	default:
		logging.Fail(w, "moderation.failed", err)
	}
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message}})
}

func (h *Handler) actor(w http.ResponseWriter, r *http.Request) (string, bool) {
	parts := strings.Fields(r.Header.Get("Authorization"))
	token := ""
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		token = parts[1]
	}
	user, err := h.auth.Me(r.Context(), token)
	if err != nil {
		failure(w, err)
		return "", false
	}
	return user.ID, true
}

func decode(w http.ResponseWriter, r *http.Request, out any) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		failure(w, domain.ErrInvalid)
		return false
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if decoder.Decode(out) != nil || decoder.Decode(&struct{}{}) != io.EOF {
		failure(w, domain.ErrInvalid)
		return false
	}
	return true
}

func (h *Handler) report(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.actor(w, r)
	if !ok {
		return
	}
	var input domain.ReportInput
	if !decode(w, r, &input) {
		return
	}
	if err := h.service.Report(r.Context(), userID, input); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) blocks(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.actor(w, r)
	if !ok {
		return
	}
	items, err := h.service.Blocks(r.Context(), userID)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"items": items})
}

func (h *Handler) block(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.actor(w, r)
	if !ok {
		return
	}
	if err := h.service.Block(r.Context(), userID, r.PathValue("userId")); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) unblock(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.actor(w, r)
	if !ok {
		return
	}
	if err := h.service.Unblock(r.Context(), userID, r.PathValue("userId")); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func number(r *http.Request, key string, fallback int) int {
	value := r.URL.Query().Get(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return parsed
}

func (h *Handler) reports(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	if status == "" {
		status = "open"
	}
	page, err := h.service.Reports(r.Context(), status, number(r, "page", 1), number(r, "pageSize", 20))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, page)
}

func (h *Handler) resolve(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Action string `json:"action"`
	}
	if !decode(w, r, &input) {
		return
	}
	report, err := h.service.Resolve(r.Context(), r.PathValue("id"), input.Action)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"report": report})
}
