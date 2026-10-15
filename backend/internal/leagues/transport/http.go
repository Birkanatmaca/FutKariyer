package transport

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/leagues/application"
	"futcareer/backend/internal/leagues/domain"
)

type Handler struct{ service *application.Service }

func write(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if status != 204 {
		_ = json.NewEncoder(w).Encode(value)
	}
}

func failure(w http.ResponseWriter, err error) {
	status, code, message := 500, "internal_error", "Lig bilgileri yüklenemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Yeniden giriş yap."
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "not_found", "Lig, takım veya maç bulunamadı."
	case errors.Is(err, domain.ErrTeamHasMatches):
		status, code, message = 409, "team_has_matches", "Bu takımın fikstürde maçları var. Önce maçları kaldır."
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", fields.Error()
	default:
		slog.Error("league operation failed", "error", err)
	}
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}

func decode(w http.ResponseWriter, r *http.Request, out any) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		write(w, 415, map[string]string{"error": "JSON içerik türü gerekli."})
		return false
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 65536))
	d.DisallowUnknownFields()
	if err := d.Decode(out); err != nil {
		write(w, 400, map[string]string{"error": "İstek okunamadı."})
		return false
	}
	if err := d.Decode(&struct{}{}); err != io.EOF {
		write(w, 400, map[string]string{"error": "İstek okunamadı."})
		return false
	}
	return true
}

func page(r *http.Request) int {
	values, ok := r.URL.Query()["page"]
	if !ok {
		return 1
	}
	if len(values) != 1 {
		return 0
	}
	n, err := strconv.Atoi(values[0])
	if err != nil {
		return 0
	}
	return n
}

func NewAdmin(service *application.Service) http.Handler {
	h := &Handler{service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/admin/leagues", func(w http.ResponseWriter, r *http.Request) {
		out, err := service.List(r.Context(), true, page(r))
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	mux.HandleFunc("GET /v1/admin/leagues/clubs", func(w http.ResponseWriter, r *http.Request) {
		out, err := service.Clubs(r.Context(), r.URL.Query().Get("search"), page(r))
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	mux.HandleFunc("POST /v1/admin/leagues", h.saveLeague)
	mux.HandleFunc("GET /v1/admin/leagues/{id}", func(w http.ResponseWriter, r *http.Request) {
		out, err := service.Get(r.Context(), r.PathValue("id"), true)
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	mux.HandleFunc("PUT /v1/admin/leagues/{id}", h.saveLeague)
	mux.HandleFunc("DELETE /v1/admin/leagues/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := service.Delete(r.Context(), r.PathValue("id")); err != nil {
			failure(w, err)
			return
		}
		write(w, 204, nil)
	})
	mux.HandleFunc("POST /v1/admin/leagues/{id}/teams", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			ClubID string `json:"clubId"`
		}
		if !decode(w, r, &in) {
			return
		}
		out, err := service.AddTeam(r.Context(), r.PathValue("id"), in.ClubID)
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 201, map[string]any{"team": out})
	})
	mux.HandleFunc("DELETE /v1/admin/leagues/{id}/teams/{teamID}", func(w http.ResponseWriter, r *http.Request) {
		if err := service.RemoveTeam(r.Context(), r.PathValue("id"), r.PathValue("teamID")); err != nil {
			failure(w, err)
			return
		}
		write(w, 204, nil)
	})
	mux.HandleFunc("POST /v1/admin/leagues/{id}/matches", h.saveMatch)
	mux.HandleFunc("PUT /v1/admin/leagues/{id}/matches/{matchID}", h.saveMatch)
	mux.HandleFunc("DELETE /v1/admin/leagues/{id}/matches/{matchID}", func(w http.ResponseWriter, r *http.Request) {
		if err := service.DeleteMatch(r.Context(), r.PathValue("id"), r.PathValue("matchID")); err != nil {
			failure(w, err)
			return
		}
		write(w, 204, nil)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		mux.ServeHTTP(w, r)
	})
}

func (h *Handler) saveLeague(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name        string `json:"name"`
		Season      string `json:"season"`
		Description string `json:"description"`
		Status      string `json:"status"`
		WinPoints   int    `json:"winPoints"`
		DrawPoints  int    `json:"drawPoints"`
		LossPoints  int    `json:"lossPoints"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.Save(r.Context(), domain.League{ID: r.PathValue("id"), Name: in.Name, Season: in.Season, Description: in.Description, Status: in.Status, WinPoints: in.WinPoints, DrawPoints: in.DrawPoints, LossPoints: in.LossPoints}, r.Method == "POST")
	if err != nil {
		failure(w, err)
		return
	}
	status := 200
	if r.Method == "POST" {
		status = 201
	}
	write(w, status, map[string]any{"league": out})
}

func (h *Handler) saveMatch(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Round      int        `json:"round"`
		HomeTeamID string     `json:"homeTeamId"`
		AwayTeamID string     `json:"awayTeamId"`
		KickoffAt  *time.Time `json:"kickoffAt"`
		HomeGoals  *int       `json:"homeGoals"`
		AwayGoals  *int       `json:"awayGoals"`
	}
	if !decode(w, r, &in) {
		return
	}
	var kickoff *time.Time
	if in.KickoffAt != nil {
		value := in.KickoffAt.UTC()
		kickoff = &value
	}
	value, err := h.service.SaveMatch(r.Context(), r.PathValue("id"), domain.Match{ID: r.PathValue("matchID"), Round: in.Round, HomeTeamID: in.HomeTeamID, AwayTeamID: in.AwayTeamID, KickoffAt: kickoff, HomeGoals: in.HomeGoals, AwayGoals: in.AwayGoals}, r.Method == "POST")
	if err != nil {
		failure(w, err)
		return
	}
	status := 200
	if r.Method == "POST" {
		status = 201
	}
	write(w, status, map[string]any{"match": value})
}

func New(authService *auth.Service, service *application.Service) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/leagues", func(w http.ResponseWriter, r *http.Request) {
		out, err := service.List(r.Context(), false, page(r))
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	mux.HandleFunc("GET /v1/leagues/{id}", func(w http.ResponseWriter, r *http.Request) {
		out, err := service.Get(r.Context(), r.PathValue("id"), false)
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		parts := strings.Fields(r.Header.Get("Authorization"))
		token := ""
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			token = parts[1]
		}
		if _, err := authService.Me(r.Context(), token); err != nil {
			failure(w, err)
			return
		}
		mux.ServeHTTP(w, r)
	})
}
