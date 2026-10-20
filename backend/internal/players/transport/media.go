package transport

import (
	"bytes"
	"errors"
	"io"
	"mime"
	"net/http"
	"time"

	authapplication "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/platform/logging"
	platformmedia "futcareer/backend/internal/platform/media"
	playerapplication "futcareer/backend/internal/players/application"
	"futcareer/backend/internal/players/domain"
)

// registerMedia adds the profile gallery routes:
//
//	POST   /v1/players/me/media              upload (multipart, single "media" part; players only)
//	DELETE /v1/players/me/media/{mediaId}    delete own item
//	GET    /v1/players/{id}/media            list a visible player's gallery (own included)
//	GET    /v1/players/{id}/media/{mediaId}  the file, with HTTP Range support
func registerMedia(mux *http.ServeMux, auth *authapplication.Service, service *playerapplication.MediaService) {
	h := &mediaHandler{auth: auth, service: service}
	mux.HandleFunc("POST /v1/players/me/media", h.upload)
	mux.HandleFunc("DELETE /v1/players/me/media/{mediaId}", h.remove)
	mux.HandleFunc("GET /v1/players/{id}/media", h.list)
	mux.HandleFunc("GET /v1/players/{id}/media/{mediaId}", h.file)
}

type mediaHandler struct {
	auth    *authapplication.Service
	service *playerapplication.MediaService
}

func (h *mediaHandler) viewer(w http.ResponseWriter, r *http.Request) (authapplication.PublicUser, bool) {
	user, err := h.auth.Me(r.Context(), bearer(r))
	if errors.Is(err, authdomain.ErrUnauthorized) {
		writeError(w, 401, "unauthorized", "Oturumun sona ermiş olabilir. Yeniden giriş yap.", nil)
		return user, false
	}
	if err != nil {
		mediaFailure(w, err)
		return user, false
	}
	return user, true
}

func mediaFailure(w http.ResponseWriter, err error) {
	invalid := "JPEG/PNG görsel (4 MiB) veya MP4 video (30 MiB) seç."
	switch {
	case errors.Is(err, domain.ErrMediaNotFound):
		writeError(w, 404, "not_found", "Medya veya profil bulunamadı.", nil)
	case errors.Is(err, domain.ErrMediaInvalid):
		writeError(w, 422, "validation_error", invalid, map[string]string{"media": invalid})
	case errors.Is(err, domain.ErrMediaLimit):
		writeError(w, 409, "media_limit", "Galeri sınırına ulaştın. Yeni medya eklemek için eskilerden birini sil.", nil)
	default:
		logging.Fail(w, "player.media.failed", err)
		writeError(w, 500, "internal_error", "İşlem tamamlanamadı. Biraz sonra tekrar dene.", nil)
	}
}

func extendDeadline(w http.ResponseWriter) {
	controller := http.NewResponseController(w)
	_ = controller.SetReadDeadline(time.Now().Add(90 * time.Second))
	_ = controller.SetWriteDeadline(time.Now().Add(90 * time.Second))
}

func (h *mediaHandler) upload(w http.ResponseWriter, r *http.Request) {
	user, ok := h.viewer(w, r)
	if !ok {
		return
	}
	if user.Role != "player" {
		writeError(w, 403, "role_not_allowed", "Bu alan oyuncu hesapları için kullanılabilir.", nil)
		return
	}
	contentType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || contentType != "multipart/form-data" {
		mediaFailure(w, domain.ErrMediaInvalid)
		return
	}
	extendDeadline(w)
	r.Body = http.MaxBytesReader(w, r.Body, platformmedia.MaxVideoBytes+16384)
	reader, err := r.MultipartReader()
	if err != nil {
		mediaFailure(w, domain.ErrMediaInvalid)
		return
	}
	var data []byte
	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			mediaFailure(w, domain.ErrMediaInvalid)
			return
		}
		if part.FormName() != "media" || data != nil {
			part.Close()
			mediaFailure(w, domain.ErrMediaInvalid)
			return
		}
		data, err = io.ReadAll(io.LimitReader(part, platformmedia.MaxVideoBytes+1))
		part.Close()
		if err != nil || len(data) == 0 || len(data) > platformmedia.MaxVideoBytes {
			mediaFailure(w, domain.ErrMediaInvalid)
			return
		}
	}
	if data == nil {
		mediaFailure(w, domain.ErrMediaInvalid)
		return
	}
	item, err := h.service.Upload(r.Context(), user.ID, data)
	if err != nil {
		mediaFailure(w, err)
		return
	}
	write(w, 201, map[string]any{"item": item})
}

func (h *mediaHandler) remove(w http.ResponseWriter, r *http.Request) {
	user, ok := h.viewer(w, r)
	if !ok {
		return
	}
	if err := h.service.Delete(r.Context(), user.ID, r.PathValue("mediaId")); err != nil {
		mediaFailure(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *mediaHandler) list(w http.ResponseWriter, r *http.Request) {
	user, ok := h.viewer(w, r)
	if !ok {
		return
	}
	items, err := h.service.List(r.Context(), user.ID, r.PathValue("id"))
	if err != nil {
		mediaFailure(w, err)
		return
	}
	write(w, 200, map[string]any{"items": items, "limits": map[string]int{"photos": domain.MaxPhotos, "videos": domain.MaxVideos}})
}

func (h *mediaHandler) file(w http.ResponseWriter, r *http.Request) {
	user, ok := h.viewer(w, r)
	if !ok {
		return
	}
	extendDeadline(w)
	item, data, err := h.service.File(r.Context(), user.ID, r.PathValue("id"), r.PathValue("mediaId"))
	if err != nil {
		mediaFailure(w, err)
		return
	}
	w.Header().Set("Content-Type", item.MIME)
	w.Header().Set("Cache-Control", "private, no-store")
	http.ServeContent(w, r, "media", time.Time{}, bytes.NewReader(data))
}
