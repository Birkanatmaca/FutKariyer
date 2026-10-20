package transport

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"futcareer/backend/internal/platform/logging"
	"futcareer/backend/internal/systemlogs/application"
	"futcareer/backend/internal/systemlogs/domain"
)

// NewAdmin serves Sistem logları behind the admin session check:
//
//	GET /v1/admin/logs?kind&q&user&hours&page
//	GET /v1/admin/logs/summary?hours
//	GET /v1/admin/logs/{id}
//	GET /v1/admin/logs/settings
//	PUT /v1/admin/logs/settings
func NewAdmin(service *application.Service) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/admin/logs", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		hours, _ := strconv.Atoi(q.Get("hours"))
		page, _ := strconv.Atoi(q.Get("page"))
		out, err := service.List(r.Context(), q.Get("kind"), q.Get("q"), q.Get("user"), hours, page)
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	mux.HandleFunc("GET /v1/admin/logs/summary", func(w http.ResponseWriter, r *http.Request) {
		hours, _ := strconv.Atoi(r.URL.Query().Get("hours"))
		out, err := service.Summary(r.Context(), hours)
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	mux.HandleFunc("GET /v1/admin/logs/settings", func(w http.ResponseWriter, r *http.Request) {
		out, err := service.Settings(r.Context())
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	mux.HandleFunc("PUT /v1/admin/logs/settings", func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			writeError(w, 415, "invalid_content_type", "JSON içerik türü gerekli.", nil)
			return
		}
		var in domain.Settings
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
		if err := decoder.Decode(&in); err != nil || decoder.Decode(&struct{}{}) != io.EOF {
			writeError(w, 400, "invalid_request", "İstek bilgileri okunamadı.", nil)
			return
		}
		out, err := service.SaveSettings(r.Context(), in, logging.CurrentUser(r.Context()))
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	mux.HandleFunc("GET /v1/admin/logs/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil || id < 1 {
			writeError(w, 404, "not_found", "Log satırı bulunamadı.", nil)
			return
		}
		out, err := service.Get(r.Context(), id)
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
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

func failure(w http.ResponseWriter, err error) {
	var fields application.ValidationError
	switch {
	case errors.As(err, &fields):
		writeError(w, 422, "validation_error", fields.Error(), fields)
	case errors.Is(err, domain.ErrNotFound):
		writeError(w, 404, "not_found", "Log satırı bulunamadı.", nil)
	default:
		logging.Fail(w, "logs.failed", err)
		writeError(w, 500, "internal_error", "Loglar yüklenemedi. Biraz sonra tekrar dene.", nil)
	}
}
