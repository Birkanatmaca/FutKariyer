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
	footballdomain "futcareer/backend/internal/football/domain"
	"futcareer/backend/internal/games/application"
	"futcareer/backend/internal/games/catalog"
	"futcareer/backend/internal/games/domain"
)

type Handler struct {
	auth  *auth.Service
	games *application.Service
}

func New(authService *auth.Service, games *application.Service) http.Handler {
	h := &Handler{auth: authService, games: games}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/games/football-guess", h.state)
	mux.HandleFunc("POST /v1/games/football-guess/runs", h.start)
	mux.HandleFunc("POST /v1/games/football-guess/runs/{id}/answers", h.answer)
	mux.HandleFunc("POST /v1/games/penalty/shootouts", h.penaltyStart)
	mux.HandleFunc("POST /v1/games/penalty/shootouts/{id}/kicks", h.penaltyKick)
	mux.HandleFunc("GET /v1/games/head-to-head", h.h2hRecord)
	mux.HandleFunc("POST /v1/games/head-to-head/runs", h.h2hStart)
	mux.HandleFunc("POST /v1/games/head-to-head/runs/{id}/answers", h.h2hAnswer)
	mux.HandleFunc("GET /v1/games/logos/{id}", h.logo)
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
	status, code, message := 500, "internal_error", "Oyun yüklenemedi. Tekrar dene; ilerlemen korunuyor."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrForbidden):
		status, code, message = 403, "forbidden", "Bu hesap oyunlara erişemiyor."
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "not_found", "Oyun bulunamadı. Oyunlar ekranını yenile."
	case errors.Is(err, domain.ErrNoHearts):
		status, code, message = 409, "no_hearts", "Kalbin kalmadı. Bir kalp 6 saatte yenilenir."
	case errors.Is(err, domain.ErrAnswerLocked):
		status, code, message = 409, "answer_locked", "Bu sorunun yanıtı daha önce kaydedildi. Oyunu yenileyip devam et."
	case errors.Is(err, domain.ErrQuestionOrder):
		status, code, message = 409, "question_order", "Oyun başka bir ekranda ilerlemiş olabilir. Oyunu yenileyip devam et."
	case errors.Is(err, footballdomain.ErrUpstream), errors.Is(err, domain.ErrNoPairs):
		status, code, message = 502, "upstream_unavailable", "Lig verileri şu anda alınamıyor. Biraz sonra tekrar dene."
		slog.Warn("head-to-head standings unavailable", "error", err)
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", fields.Error()
	default:
		slog.Error("football game failed", "error", err)
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
func (h *Handler) state(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	s, err := h.games.State(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, s)
}
func (h *Handler) start(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1))
	if err != nil || len(data) > 0 {
		failure(w, auth.ValidationError{"game": "Başlatma isteği gövdesi boş olmalı."})
		return
	}
	s, err := h.games.Start(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, s)
}
func (h *Handler) answer(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	var input struct {
		QuestionID string `json:"questionId"`
		OptionID   string `json:"optionId"`
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	d.DisallowUnknownFields()
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") || d.Decode(&input) != nil || d.Decode(&struct{}{}) != io.EOF {
		failure(w, auth.ValidationError{"answer": "Geçerli bir soru ve seçenek gönder."})
		return
	}
	s, err := h.games.Answer(r.Context(), id, r.PathValue("id"), input.QuestionID, input.OptionID)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, s)
}
func (h *Handler) penaltyStart(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1))
	if err != nil || len(data) > 0 {
		failure(w, auth.ValidationError{"game": "Başlatma isteği gövdesi boş olmalı."})
		return
	}
	s, err := h.games.StartShootout(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, s)
}
func (h *Handler) penaltyKick(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	var input struct {
		Index int    `json:"index"`
		Side  string `json:"side"`
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	d.DisallowUnknownFields()
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") || d.Decode(&input) != nil || d.Decode(&struct{}{}) != io.EOF {
		failure(w, auth.ValidationError{"kick": "Geçerli bir sıra ve taraf gönder."})
		return
	}
	s, err := h.games.KickShootout(r.Context(), id, r.PathValue("id"), input.Index, input.Side)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, s)
}
func (h *Handler) logo(w http.ResponseWriter, r *http.Request) {
	data, err := catalog.Logo(r.PathValue("id"))
	if err != nil {
		failure(w, err)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.WriteHeader(200)
	_, _ = w.Write(data)
}
func (h *Handler) h2hRecord(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	rec, err := h.games.HeadToHead(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, rec)
}
func (h *Handler) h2hStart(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1))
	if err != nil || len(data) > 0 {
		failure(w, auth.ValidationError{"game": "Başlatma isteği gövdesi boş olmalı."})
		return
	}
	run, err := h.games.StartHeadToHead(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, run)
}
func (h *Handler) h2hAnswer(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	var input struct {
		RoundID string `json:"roundId"`
		Pick    string `json:"pick"`
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	d.DisallowUnknownFields()
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") || d.Decode(&input) != nil || d.Decode(&struct{}{}) != io.EOF {
		failure(w, auth.ValidationError{"answer": "Geçerli bir tur ve seçim gönder."})
		return
	}
	result, err := h.games.AnswerHeadToHead(r.Context(), id, r.PathValue("id"), input.RoundID, input.Pick)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, result)
}
