package transport

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"

	"futcareer/backend/internal/registrations/data"
)

var validID = regexp.MustCompile(`^[a-f0-9]{32}$`)

func write(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func fail(w http.ResponseWriter, status int, code, message string, fields map[string]string) {
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}

// NewAdmin serves the club and organizer application queue. It is mounted behind the admin session check.
func NewAdmin(repo *data.Postgres) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/admin/applications", func(w http.ResponseWriter, r *http.Request) {
		status := r.URL.Query().Get("status")
		if status == "" {
			status = "pending"
		}
		if status != "pending" && status != "approved" && status != "rejected" {
			fail(w, 422, "validation_error", "Durum pending, approved veya rejected olmalı.", map[string]string{"status": "Geçersiz durum."})
			return
		}
		items, err := repo.List(r.Context(), status)
		if err != nil {
			slog.Error("application list failed", "error", err)
			fail(w, 500, "internal_error", "Başvurular yüklenemedi.", nil)
			return
		}
		write(w, 200, map[string]any{"items": items})
	})
	mux.HandleFunc("PUT /v1/admin/applications/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !validID.MatchString(id) {
			fail(w, 404, "not_found", "Başvuru bulunamadı.", nil)
			return
		}
		var in struct {
			Decision string `json:"decision"`
			Reason   string `json:"reason"`
		}
		d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
		d.DisallowUnknownFields()
		if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") || d.Decode(&in) != nil || d.Decode(&struct{}{}) != io.EOF {
			fail(w, 422, "validation_error", "Geçerli bir karar gönder.", nil)
			return
		}
		in.Reason = strings.TrimSpace(in.Reason)
		if in.Decision != "approve" && in.Decision != "reject" {
			fail(w, 422, "validation_error", "Karar approve veya reject olmalı.", map[string]string{"decision": "Geçersiz karar."})
			return
		}
		if utf8.RuneCountInString(in.Reason) > 300 {
			fail(w, 422, "validation_error", "Gerekçe en fazla 300 karakter olabilir.", map[string]string{"reason": "En fazla 300 karakter."})
			return
		}
		if in.Decision == "approve" {
			in.Reason = ""
		}
		out, err := repo.Decide(r.Context(), id, in.Decision == "approve", in.Reason)
		switch {
		case errors.Is(err, data.ErrNotFound):
			fail(w, 404, "not_found", "Başvuru bulunamadı.", nil)
		case errors.Is(err, data.ErrInvalidState):
			fail(w, 409, "already_decided", "Bu başvuru zaten sonuçlandırıldı. Listeyi yenile.", nil)
		case err != nil:
			slog.Error("application decision failed", "error", err)
			fail(w, 500, "internal_error", "Karar kaydedilemedi.", nil)
		default:
			write(w, 200, map[string]any{"application": out})
		}
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		mux.ServeHTTP(w, r)
	})
}
