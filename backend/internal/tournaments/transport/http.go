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
	"futcareer/backend/internal/tournaments/application"
	"futcareer/backend/internal/tournaments/domain"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
}

func New(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{auth: authService, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/tournaments", h.open)
	mux.HandleFunc("GET /v1/tournaments/{id}", h.get)
	mux.HandleFunc("POST /v1/tournaments/{id}/entries", h.enter)
	mux.HandleFunc("GET /v1/me/tournament-entries", h.clubEntries)
	mux.HandleFunc("PUT /v1/me/tournament-entries/{id}/withdraw", h.withdraw)
	mux.HandleFunc("GET /v1/me/tournaments", h.mine)
	mux.HandleFunc("POST /v1/me/tournaments", h.create)
	mux.HandleFunc("PUT /v1/me/tournaments/{id}/status", h.status)
	mux.HandleFunc("GET /v1/me/tournaments/{id}/entries", h.entries)
	mux.HandleFunc("PUT /v1/me/tournaments/{id}/entries/{entryId}", h.decide)
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
	status, code, message := 500, "internal_error", "Turnuvalar yüklenemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "not_found", "Turnuva veya başvuru bulunamadı."
	case errors.Is(err, domain.ErrForbidden):
		status, code, message = 403, "forbidden", "Bu işlem hesabına açık değil. Organizasyon hesabının doğrulanmış olması gerekir."
	case errors.Is(err, domain.ErrClosed):
		status, code, message = 409, "closed", "Bu turnuva artık başvuru almıyor."
	case errors.Is(err, domain.ErrNotEligible):
		status, code, message = 409, "not_eligible", "Takım türün bu turnuvaya başvuramıyor."
	case errors.Is(err, domain.ErrFull):
		status, code, message = 409, "full", "Turnuvanın takım kapasitesi doldu."
	case errors.Is(err, domain.ErrDuplicate):
		status, code, message = 409, "duplicate", "Bu turnuvaya zaten başvurdun."
	case errors.Is(err, domain.ErrInvalidState):
		status, code, message = 409, "invalid_state", "Bu işlem şu anki durumda yapılamaz. Listeyi yenile."
	case errors.Is(err, domain.ErrNotInSquad):
		status, code, message = 422, "not_in_squad", "Turnuva kadrosu yalnızca kulübünün kadrosundaki oyunculardan oluşabilir."
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", fields.Error()
	default:
		logging.Fail(w, "tournament.failed", err)
	}
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}

// actor resolves the signed-in mobile account; role restricts it when set.
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
	if role != "" && u.Role != role {
		failure(w, domain.ErrForbidden)
		return "", false
	}
	return u.ID, true
}

func decode(w http.ResponseWriter, r *http.Request, out any) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		failure(w, auth.ValidationError{"request": "JSON biçiminde istek gönder."})
		return false
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16384))
	d.DisallowUnknownFields()
	if d.Decode(out) != nil || d.Decode(&struct{}{}) != io.EOF {
		failure(w, auth.ValidationError{"request": "Geçerli bir istek gönder."})
		return false
	}
	return true
}

func (h *Handler) open(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.actor(w, r, ""); !ok {
		return
	}
	page := 1
	if raw := r.URL.Query().Get("page"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil {
			failure(w, auth.ValidationError{"page": "Sayfa numarası geçersiz."})
			return
		}
		page = n
	}
	out, err := h.service.Open(r.Context(), page)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, out)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.actor(w, r, ""); !ok {
		return
	}
	out, err := h.service.Get(r.Context(), r.PathValue("id"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"tournament": out})
}

func (h *Handler) enter(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "club")
	if !ok {
		return
	}
	var in struct {
		Message   string   `json:"message"`
		PlayerIDs []string `json:"playerIds"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.Enter(r.Context(), id, r.PathValue("id"), in.Message, in.PlayerIDs)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, map[string]any{"entry": out})
}

func (h *Handler) clubEntries(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "club")
	if !ok {
		return
	}
	out, err := h.service.ClubEntries(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"items": out})
}

func (h *Handler) withdraw(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "club")
	if !ok {
		return
	}
	out, err := h.service.Withdraw(r.Context(), id, r.PathValue("id"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"entry": out})
}

func (h *Handler) mine(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "organizer")
	if !ok {
		return
	}
	out, err := h.service.Mine(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"items": out})
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "organizer")
	if !ok {
		return
	}
	var in application.Input
	if !decode(w, r, &in) {
		return
	}
	out, notified, err := h.service.Create(r.Context(), id, in)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, map[string]any{"tournament": out, "notifiedClubs": notified})
}

func (h *Handler) status(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "organizer")
	if !ok {
		return
	}
	var in struct {
		Status string `json:"status"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.SetStatus(r.Context(), id, r.PathValue("id"), in.Status)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"tournament": out})
}

func (h *Handler) entries(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "organizer")
	if !ok {
		return
	}
	out, err := h.service.Entries(r.Context(), id, r.PathValue("id"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"items": out})
}

func (h *Handler) decide(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, "organizer")
	if !ok {
		return
	}
	var in struct {
		Decision string `json:"decision"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.Decide(r.Context(), id, r.PathValue("id"), r.PathValue("entryId"), in.Decision)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"entry": out})
}
