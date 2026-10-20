package transport

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/platform/logging"
	"futcareer/backend/internal/rating/application"
	"futcareer/backend/internal/rating/domain"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
}

func headers(mux *http.ServeMux) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		mux.ServeHTTP(w, r)
	})
}

// New serves the account side: the board and task claims.
func New(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{auth: authService, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/rating", h.board)
	mux.HandleFunc("POST /v1/rating/tasks/{kind}/claim", h.claim)
	return headers(mux)
}

// NewAdmin serves season and task management behind the admin session check.
func NewAdmin(service *application.Service) http.Handler {
	h := &Handler{service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/admin/rating/seasons", h.seasons)
	mux.HandleFunc("POST /v1/admin/rating/seasons", h.createSeason)
	mux.HandleFunc("PUT /v1/admin/rating/seasons/{id}", h.updateSeason)
	mux.HandleFunc("DELETE /v1/admin/rating/seasons/{id}", h.deleteSeason)
	mux.HandleFunc("GET /v1/admin/rating/seasons/{id}/leaderboard", h.seasonBoard)
	mux.HandleFunc("GET /v1/admin/rating/tasks", h.tasks)
	mux.HandleFunc("PUT /v1/admin/rating/tasks/{kind}", h.updateTask)
	return headers(mux)
}

func write(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func failure(w http.ResponseWriter, err error) {
	status, code, message := 500, "internal_error", "Global rating yüklenemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrForbidden):
		status, code, message = 403, "forbidden", "Bu hesap global ratinge katılamıyor."
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "not_found", "Kayıt bulunamadı. Listeyi yenile."
	case errors.Is(err, domain.ErrOverlap):
		status, code, message = 409, "season_overlap", "Bu tarihler yayındaki başka bir sezonla çakışıyor."
	case errors.Is(err, domain.ErrNoSeason):
		status, code, message = 409, "no_season", "Şu anda devam eden bir sezon yok."
	case errors.Is(err, domain.ErrTaskInactive):
		status, code, message = 409, "task_inactive", "Bu görev şu anda kapalı."
	case errors.Is(err, domain.ErrTaskIncomplete):
		status, code, message = 409, "task_incomplete", "Görevi tamamlamadan puanını alamazsın."
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", fields.Error()
	default:
		logging.Fail(w, "rating.failed", err)
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
	if u.Role != "player" && u.Role != "club" && u.Role != "coach" {
		failure(w, domain.ErrForbidden)
		return "", false
	}
	return u.ID, true
}

func seasonJSON(s domain.Season, now time.Time) map[string]any {
	prizes := s.Prizes
	if prizes == nil {
		prizes = []domain.Prize{}
	}
	return map[string]any{
		"id": s.ID, "title": s.Title, "description": s.Description,
		"startsAt": s.StartsAt, "endsAt": s.EndsAt, "prizes": prizes,
		"published": s.Published, "status": s.Status(now),
		"createdAt": s.CreatedAt, "updatedAt": s.UpdatedAt, "players": s.Players,
	}
}

func standingJSON(s domain.Standing) map[string]any {
	return map[string]any{"rank": s.Rank, "userId": s.UserID, "fullName": s.FullName, "role": s.Role, "points": s.Points}
}

func boardJSON(b domain.Board) map[string]any {
	out := map[string]any{"serverTime": b.ServerTime, "season": nil, "me": nil}
	if b.Season != nil {
		out["season"] = seasonJSON(*b.Season, b.ServerTime)
	}
	top := make([]map[string]any, 0, len(b.Top))
	for _, s := range b.Top {
		top = append(top, standingJSON(s))
	}
	out["leaderboard"] = top
	if b.Me != nil {
		out["me"] = map[string]any{"rank": b.Me.Rank, "points": b.Me.Points}
	}
	tasks := make([]map[string]any, 0, len(b.Tasks))
	for _, t := range b.Tasks {
		tasks = append(tasks, map[string]any{"kind": t.Kind, "target": t.Target, "points": t.Points, "progress": t.Progress, "claimed": t.Claimed})
	}
	out["tasks"] = tasks
	return out
}

func (h *Handler) board(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	b, err := h.service.Board(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, boardJSON(b))
}

func emptyBody(w http.ResponseWriter, r *http.Request) bool {
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1))
	return err == nil && len(data) == 0
}

func (h *Handler) claim(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	if !emptyBody(w, r) {
		failure(w, auth.ValidationError{"task": "Görev isteği gövdesi boş olmalı."})
		return
	}
	b, err := h.service.ClaimTask(r.Context(), id, r.PathValue("kind"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, boardJSON(b))
}

func decode(w http.ResponseWriter, r *http.Request, value any) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		failure(w, auth.ValidationError{"body": "JSON biçiminde gönder."})
		return false
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil || decoder.Decode(&struct{}{}) != io.EOF {
		failure(w, auth.ValidationError{"body": "Geçerli bir istek gönder."})
		return false
	}
	return true
}

func (h *Handler) seasons(w http.ResponseWriter, r *http.Request) {
	items, now, err := h.service.Seasons(r.Context())
	if err != nil {
		failure(w, err)
		return
	}
	out := make([]map[string]any, 0, len(items))
	for _, s := range items {
		out = append(out, seasonJSON(s, now))
	}
	write(w, 200, map[string]any{"items": out, "serverTime": now})
}

func (h *Handler) createSeason(w http.ResponseWriter, r *http.Request) {
	var in application.SeasonInput
	if !decode(w, r, &in) {
		return
	}
	s, err := h.service.CreateSeason(r.Context(), in)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, seasonJSON(s, time.Now().UTC()))
}

func (h *Handler) updateSeason(w http.ResponseWriter, r *http.Request) {
	var in application.SeasonInput
	if !decode(w, r, &in) {
		return
	}
	s, err := h.service.UpdateSeason(r.Context(), r.PathValue("id"), in)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, seasonJSON(s, time.Now().UTC()))
}

func (h *Handler) deleteSeason(w http.ResponseWriter, r *http.Request) {
	if err := h.service.DeleteSeason(r.Context(), r.PathValue("id")); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(204)
}

func (h *Handler) seasonBoard(w http.ResponseWriter, r *http.Request) {
	s, top, err := h.service.SeasonBoard(r.Context(), r.PathValue("id"))
	if err != nil {
		failure(w, err)
		return
	}
	items := make([]map[string]any, 0, len(top))
	for _, t := range top {
		items = append(items, standingJSON(t))
	}
	write(w, 200, map[string]any{"season": seasonJSON(s, time.Now().UTC()), "leaderboard": items})
}

func taskJSON(t domain.Task) map[string]any {
	return map[string]any{"kind": t.Kind, "active": t.Active, "target": t.Target, "points": t.Points}
}

func (h *Handler) tasks(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.Tasks(r.Context())
	if err != nil {
		failure(w, err)
		return
	}
	out := make([]map[string]any, 0, len(items))
	for _, t := range items {
		out = append(out, taskJSON(t))
	}
	write(w, 200, map[string]any{"items": out})
}

func (h *Handler) updateTask(w http.ResponseWriter, r *http.Request) {
	var in application.TaskInput
	if !decode(w, r, &in) {
		return
	}
	t, err := h.service.UpdateTask(r.Context(), r.PathValue("kind"), in)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, taskJSON(t))
}
