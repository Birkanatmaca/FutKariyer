package transport

import (
	"encoding/json"
	"errors"
	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/content/application"
	"futcareer/backend/internal/content/domain"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
)

type Handler struct {
	service *application.Service
	auth    *auth.Service
}

func write(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func failure(w http.ResponseWriter, err error) {
	status, code, message := 500, "internal_error", "İçerik yüklenemedi. Biraz sonra tekrar dene."
	var fields auth.ValidationError
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized):
		status, code, message = 401, "unauthorized", "Yeniden giriş yap."
	case errors.Is(err, authdomain.ErrNotFound):
		status, code, message = 404, "not_found", "İçerik bulunamadı."
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", fields.Error()
	default:
		slog.Error("content operation failed", "error", err)
	}
	write(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}
func decode(w http.ResponseWriter, r *http.Request, out any) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		write(w, 415, map[string]any{"error": map[string]string{"message": "JSON içerik türü gerekli."}})
		return false
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 131072))
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
func secure(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}
func (h *Handler) image(w http.ResponseWriter, r *http.Request, admin bool) {
	value, err := h.service.Image(r.Context(), r.PathValue("id"), admin)
	if err != nil {
		failure(w, err)
		return
	}
	w.Header().Set("Content-Type", value.MIME)
	w.Header().Set("Content-Length", strconv.Itoa(len(value.Data)))
	_, _ = w.Write(value.Data)
}
func New(authService *auth.Service, service *application.Service) http.Handler {
	h := &Handler{service: service, auth: authService}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/me/club-news", h.clubNews)
	mux.HandleFunc("POST /v1/me/club-news", h.submitClubNews)
	mux.HandleFunc("GET /v1/content/home", func(w http.ResponseWriter, r *http.Request) {
		out, err := h.service.Home(r.Context())
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	mux.HandleFunc("GET /v1/content/popup", h.nextPopup)
	mux.HandleFunc("POST /v1/content/popup/{id}/views", h.popupViewed)
	mux.HandleFunc("GET /v1/content/news", func(w http.ResponseWriter, r *http.Request) {
		out, err := h.service.News(r.Context(), false, false, page(r))
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	mux.HandleFunc("GET /v1/content/news/{id}", func(w http.ResponseWriter, r *http.Request) {
		out, err := h.service.Article(r.Context(), r.PathValue("id"), false)
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, map[string]any{"article": out})
	})
	images := http.NewServeMux()
	images.HandleFunc("GET /v1/content/images/{id}", func(w http.ResponseWriter, r *http.Request) { h.image(w, r, false) })
	return secure(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/v1/content/images/") {
			images.ServeHTTP(w, r)
			return
		}
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
	}))
}

// NewAdmin is mounted inside the existing administrator cookie/Origin middleware.
func NewAdmin(service *application.Service) http.Handler {
	h := &Handler{service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("PUT /v1/admin/content/news/{id}/review", h.reviewClubNews)
	mux.HandleFunc("GET /v1/admin/content/reviews", func(w http.ResponseWriter, r *http.Request) {
		items, err := service.PendingClubArticles(r.Context())
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, map[string]any{"items": items})
	})
	mux.HandleFunc("GET /v1/admin/content/images/{id}", func(w http.ResponseWriter, r *http.Request) { h.image(w, r, true) })
	mux.HandleFunc("POST /v1/admin/content/images", h.upload)
	mux.HandleFunc("GET /v1/admin/content/ads", func(w http.ResponseWriter, r *http.Request) {
		out, err := service.Ads(r.Context(), true, page(r))
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	mux.HandleFunc("GET /v1/admin/content/news", func(w http.ResponseWriter, r *http.Request) {
		out, err := service.News(r.Context(), true, false, page(r))
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	for _, method := range []string{"POST", "PUT"} {
		suffix := ""
		if method == "PUT" {
			suffix = "/{id}"
		}
		mux.HandleFunc(method+" /v1/admin/content/ads"+suffix, h.saveAd)
		mux.HandleFunc(method+" /v1/admin/content/news"+suffix, h.saveNews)
	}
	mux.HandleFunc("DELETE /v1/admin/content/ads/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := service.DeleteAd(r.Context(), r.PathValue("id")); err != nil {
			failure(w, err)
			return
		}
		w.WriteHeader(204)
	})
	mux.HandleFunc("DELETE /v1/admin/content/news/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := service.DeleteArticle(r.Context(), r.PathValue("id")); err != nil {
			failure(w, err)
			return
		}
		w.WriteHeader(204)
	})
	h.registerAdminPopups(mux)
	return secure(mux)
}
func (h *Handler) upload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, application.MaxImageBytes+524288)
	if err := r.ParseMultipartForm(application.MaxImageBytes + 524288); err != nil {
		failure(w, auth.ValidationError{"image": "En fazla 4 MiB bir JPEG/PNG görsel yükle."})
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	file, _, err := r.FormFile("image")
	if err != nil {
		failure(w, auth.ValidationError{"image": "Bir görsel seç."})
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, application.MaxImageBytes+1))
	if err != nil {
		failure(w, err)
		return
	}
	id, err := h.service.Upload(r.Context(), data)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, map[string]string{"imageId": id})
}
func (h *Handler) saveAd(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Title     string `json:"title"`
		ImageID   string `json:"imageId"`
		Active    bool   `json:"active"`
		SortOrder int    `json:"sortOrder"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.SaveAd(r.Context(), domain.Advertisement{ID: r.PathValue("id"), Title: in.Title, ImageID: in.ImageID, Active: in.Active, SortOrder: in.SortOrder}, r.Method == "POST")
	if err != nil {
		failure(w, err)
		return
	}
	status := 200
	if r.Method == "POST" {
		status = 201
	}
	write(w, status, map[string]any{"advertisement": out})
}
func (h *Handler) saveNews(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Title      string `json:"title"`
		Summary    string `json:"summary"`
		Body       string `json:"body"`
		ImageID    string `json:"imageId"`
		Published  bool   `json:"published"`
		ShowOnHome bool   `json:"showOnHome"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.SaveArticle(r.Context(), domain.Article{ID: r.PathValue("id"), Title: in.Title, Summary: in.Summary, Body: in.Body, ImageID: in.ImageID, Published: in.Published, ShowOnHome: in.ShowOnHome}, r.Method == "POST")
	if err != nil {
		failure(w, err)
		return
	}
	status := 200
	if r.Method == "POST" {
		status = 201
	}
	write(w, status, map[string]any{"article": out})
}

func (h *Handler) clubActor(w http.ResponseWriter, r *http.Request) (string, bool) {
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
	if u.Role != "club" {
		writeForbidden(w)
		return "", false
	}
	return u.ID, true
}

func writeForbidden(w http.ResponseWriter) {
	write(w, 403, map[string]any{"error": map[string]any{"code": "forbidden", "message": "Bu alan yalnızca kulüp hesaplarına açık.", "fields": nil}})
}

func (h *Handler) clubNews(w http.ResponseWriter, r *http.Request) {
	id, ok := h.clubActor(w, r)
	if !ok {
		return
	}
	items, err := h.service.ClubArticles(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"items": items})
}

func (h *Handler) submitClubNews(w http.ResponseWriter, r *http.Request) {
	id, ok := h.clubActor(w, r)
	if !ok {
		return
	}
	var in struct {
		Title   string `json:"title"`
		Summary string `json:"summary"`
		Body    string `json:"body"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.SubmitClubArticle(r.Context(), id, domain.Article{Title: in.Title, Summary: in.Summary, Body: in.Body})
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 201, map[string]any{"article": out})
}

func (h *Handler) reviewClubNews(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Decision string `json:"decision"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.ReviewClubArticle(r.Context(), r.PathValue("id"), in.Decision)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, 200, map[string]any{"article": out})
}
