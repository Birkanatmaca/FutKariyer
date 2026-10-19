package transport

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strings"

	"futcareer/backend/internal/account/application"
	"futcareer/backend/internal/account/domain"
	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	platformmedia "futcareer/backend/internal/platform/media"
)

type Handler struct {
	auth    *auth.Service
	service *application.Service
}

// New serves the signed-in account's profile and photo, and public avatars:
//
//	GET    /v1/me/profile
//	PUT    /v1/me/profile
//	PUT    /v1/me/avatar      multipart, single "avatar" part
//	DELETE /v1/me/avatar
//	GET    /v1/users/{id}/avatar
func New(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{auth: authService, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/me/profile", h.get)
	mux.HandleFunc("PUT /v1/me/profile", h.save)
	mux.HandleFunc("PUT /v1/me/avatar", h.upload)
	mux.HandleFunc("DELETE /v1/me/avatar", h.remove)
	mux.HandleFunc("GET /v1/users/{id}/avatar", h.avatar)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		mux.ServeHTTP(w, r)
	})
}

func write(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func failure(w http.ResponseWriter, err error) {
	status, code, message := 500, "internal_error", "Profil kaydedilemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrForbidden):
		status, code, message = 403, "forbidden", "Bu hesap profilini düzenleyemiyor."
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "not_found", "Fotoğraf bulunamadı."
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", fields.Error()
	default:
		slog.Error("account profile request failed", "error", err)
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
	return u.ID, true
}

func profileJSON(p domain.Profile) map[string]any {
	var birth any
	if p.BirthDate != nil {
		birth = p.BirthDate.Format("2006-01-02")
	}
	return map[string]any{"profile": map[string]any{
		"id": p.ID, "role": p.Role, "fullName": p.FullName, "username": p.Username, "email": p.Email,
		"city": p.City, "district": p.District, "birthDate": birth, "bio": p.Bio,
		"heightCm": p.HeightCm, "weightKg": p.WeightKg, "avatarVersion": p.AvatarVersion,
	}}
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	p, err := h.service.Get(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, profileJSON(p))
}

func (h *Handler) save(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		failure(w, auth.ValidationError{"profile": "JSON biçiminde gönder."})
		return
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	decoder.DisallowUnknownFields()
	var in application.Input
	if err := decoder.Decode(&in); err != nil || decoder.Decode(&struct{}{}) != io.EOF {
		failure(w, auth.ValidationError{"profile": "Geçerli bir profil gönder."})
		return
	}
	p, err := h.service.Save(r.Context(), id, in)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, profileJSON(p))
}

func (h *Handler) upload(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	invalid := auth.ValidationError{"avatar": "En fazla 4 MiB olan bir JPEG veya PNG fotoğraf seç."}
	contentType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || contentType != "multipart/form-data" {
		failure(w, invalid)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, platformmedia.MaxImageBytes+16384)
	reader, err := r.MultipartReader()
	if err != nil {
		failure(w, invalid)
		return
	}
	var data []byte
	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil || part.FormName() != "avatar" || data != nil {
			if part != nil {
				part.Close()
			}
			failure(w, invalid)
			return
		}
		data, err = io.ReadAll(io.LimitReader(part, platformmedia.MaxImageBytes+1))
		part.Close()
		if err != nil || len(data) == 0 || len(data) > platformmedia.MaxImageBytes {
			failure(w, invalid)
			return
		}
	}
	if data == nil {
		failure(w, invalid)
		return
	}
	p, err := h.service.SetAvatar(r.Context(), id, data)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, profileJSON(p))
}

func (h *Handler) remove(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r)
	if !ok {
		return
	}
	p, err := h.service.DeleteAvatar(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, profileJSON(p))
}

// avatar is public; clients add ?v=avatarVersion, so the file may be cached.
func (h *Handler) avatar(w http.ResponseWriter, r *http.Request) {
	a, err := h.service.Avatar(r.Context(), r.PathValue("id"))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			http.NotFound(w, r)
			return
		}
		slog.Error("avatar read failed", "error", err)
		http.Error(w, "", 500)
		return
	}
	w.Header().Set("Content-Type", a.MIME)
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
	http.ServeContent(w, r, "", a.UpdatedAt, strings.NewReader(string(a.Data)))
}
