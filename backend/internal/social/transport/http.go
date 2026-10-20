package transport

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strings"
	"time"

	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/platform/logging"
	"futcareer/backend/internal/social/application"
	"futcareer/backend/internal/social/domain"
)

func write(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func failure(w http.ResponseWriter, err error) {
	status, code, message := 500, "internal_error", "Sosyal akış yüklenemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap."
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "not_found", "Gönderi veya yanıt bulunamadı."
	case errors.Is(err, domain.ErrForbidden):
		status, code, message = 403, "forbidden", "Bu işlem için erişimin yok."
	case errors.Is(err, domain.ErrRateLimited):
		status, code, message = 429, "rate_limited", "Çok hızlı paylaşıyorsun. Birkaç saniye bekleyip tekrar dene."
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", fields.Error()
	default:
		logging.Fail(w, "social.failed", err)
	}
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}
func decode(w http.ResponseWriter, r *http.Request, out any) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		write(w, 415, map[string]any{"error": map[string]string{"message": "JSON içerik türü gerekli."}})
		return false
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	d.DisallowUnknownFields()
	if err := d.Decode(out); err != nil {
		write(w, 400, map[string]any{"error": map[string]string{"message": "İstek okunamadı."}})
		return false
	}
	if err := d.Decode(&struct{}{}); err != io.EOF {
		write(w, 400, map[string]any{"error": map[string]string{"message": "İstek okunamadı."}})
		return false
	}
	return true
}

type viewerKey struct{}

func viewerID(r *http.Request) string { return r.Context().Value(viewerKey{}).(string) }

func New(authService *auth.Service, service *application.Service) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/social/posts", func(w http.ResponseWriter, r *http.Request) {
		out, err := service.Feed(r.Context(), viewerID(r), r.URL.Query().Get("cursor"), r.URL.Query().Get("scope"))
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	mux.HandleFunc("POST /v1/social/posts", func(w http.ResponseWriter, r *http.Request) {
		body, media, onProfile, err := readPost(w, r)
		if err != nil {
			failure(w, err)
			return
		}
		out, err := service.CreatePost(r.Context(), viewerID(r), body, media, onProfile)
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 201, map[string]any{"post": out})
	})
	mux.HandleFunc("GET /v1/social/posts/{id}", func(w http.ResponseWriter, r *http.Request) {
		out, err := service.GetPost(r.Context(), viewerID(r), r.PathValue("id"))
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, map[string]any{"post": out})
	})
	mux.HandleFunc("GET /v1/social/posts/{id}/media", func(w http.ResponseWriter, r *http.Request) {
		extendMediaDeadline(w)
		media, err := service.Media(r.Context(), viewerID(r), r.PathValue("id"))
		if err != nil {
			failure(w, err)
			return
		}
		w.Header().Set("Content-Type", media.MIME)
		http.ServeContent(w, r, "media", time.Time{}, bytes.NewReader(media.Data))
	})
	mux.HandleFunc("GET /v1/social/users/{id}/posts", func(w http.ResponseWriter, r *http.Request) {
		out, err := service.UserPosts(r.Context(), viewerID(r), r.PathValue("id"), r.URL.Query().Get("cursor"), r.URL.Query().Get("filter"))
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	mux.HandleFunc("PUT /v1/social/users/{id}/follow", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Following *bool `json:"following"`
		}
		if !decode(w, r, &in) {
			return
		}
		if in.Following == nil {
			failure(w, auth.ValidationError{"following": "Takip durumunu belirt."})
			return
		}
		if err := service.SetFollow(r.Context(), viewerID(r), r.PathValue("id"), *in.Following); err != nil {
			failure(w, err)
			return
		}
		write(w, 200, map[string]bool{"following": *in.Following})
	})
	mux.HandleFunc("DELETE /v1/social/posts/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := service.DeletePost(r.Context(), viewerID(r), r.PathValue("id")); err != nil {
			failure(w, err)
			return
		}
		w.WriteHeader(204)
	})
	mux.HandleFunc("PUT /v1/social/posts/{id}/like", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Liked *bool `json:"liked"`
		}
		if !decode(w, r, &in) {
			return
		}
		if in.Liked == nil {
			failure(w, auth.ValidationError{"liked": "Beğeni durumunu belirt."})
			return
		}
		out, err := service.SetLike(r.Context(), viewerID(r), r.PathValue("id"), *in.Liked)
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, map[string]any{"post": out})
	})
	mux.HandleFunc("GET /v1/social/posts/{id}/replies", func(w http.ResponseWriter, r *http.Request) {
		out, err := service.Replies(r.Context(), viewerID(r), r.PathValue("id"), r.URL.Query().Get("cursor"))
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	mux.HandleFunc("POST /v1/social/posts/{id}/replies", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Body string `json:"body"`
		}
		if !decode(w, r, &in) {
			return
		}
		out, err := service.CreateReply(r.Context(), viewerID(r), r.PathValue("id"), in.Body)
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 201, map[string]any{"reply": out})
	})
	mux.HandleFunc("DELETE /v1/social/posts/{id}/replies/{replyID}", func(w http.ResponseWriter, r *http.Request) {
		if err := service.DeleteReply(r.Context(), viewerID(r), r.PathValue("id"), r.PathValue("replyID")); err != nil {
			failure(w, err)
			return
		}
		w.WriteHeader(204)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		parts := strings.Fields(r.Header.Get("Authorization"))
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			failure(w, authdomain.ErrUnauthorized)
			return
		}
		user, err := authService.Me(r.Context(), parts[1])
		if err != nil {
			failure(w, err)
			return
		}
		if user.Role != "player" && user.Role != "club" && user.Role != "coach" {
			failure(w, domain.ErrForbidden)
			return
		}
		mux.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), viewerKey{}, user.ID)))
	})
}

// readPost returns the body, optional media and the "show on profile" choice
// (multipart part showOnProfile = "true"; text-only JSON posts never show).
func readPost(w http.ResponseWriter, r *http.Request) (string, []byte, bool, error) {
	invalid := auth.ValidationError{"media": "Gönderi okunamadı. Tek görsel veya video seç."}
	contentType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil {
		return "", nil, false, invalid
	}
	if contentType == "application/json" {
		var in struct {
			Body string `json:"body"`
		}
		d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
		d.DisallowUnknownFields()
		if d.Decode(&in) != nil || d.Decode(&struct{}{}) != io.EOF {
			return "", nil, false, invalid
		}
		return in.Body, nil, false, nil
	}
	if contentType != "multipart/form-data" {
		return "", nil, false, invalid
	}
	extendMediaDeadline(w)
	r.Body = http.MaxBytesReader(w, r.Body, application.MaxVideoBytes+16384)
	reader, err := r.MultipartReader()
	if err != nil {
		return "", nil, false, invalid
	}
	var body string
	var media []byte
	onProfile := false
	seen := map[string]bool{}
	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", nil, false, invalid
		}
		name := part.FormName()
		if seen[name] || (name != "body" && name != "media" && name != "showOnProfile") {
			part.Close()
			return "", nil, false, invalid
		}
		seen[name] = true
		limit := int64(8192)
		if name == "media" {
			limit = application.MaxVideoBytes
		}
		value, err := io.ReadAll(io.LimitReader(part, limit+1))
		part.Close()
		if err != nil || int64(len(value)) > limit {
			return "", nil, false, invalid
		}
		switch name {
		case "body":
			body = string(value)
		case "showOnProfile":
			switch string(value) {
			case "true":
				onProfile = true
			case "false":
			default:
				return "", nil, false, invalid
			}
		default:
			if len(value) == 0 {
				return "", nil, false, invalid
			}
			media = value
		}
	}
	return body, media, onProfile, nil
}

// Only authenticated, size-bounded media requests need a longer transfer deadline.
func extendMediaDeadline(w http.ResponseWriter) {
	controller := http.NewResponseController(w)
	_ = controller.SetReadDeadline(time.Now().Add(90 * time.Second))
	_ = controller.SetWriteDeadline(time.Now().Add(90 * time.Second))
}
