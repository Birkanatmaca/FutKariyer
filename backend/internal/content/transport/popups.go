package transport

import (
	"net/http"
	"strings"

	"futcareer/backend/internal/content/domain"
)

// viewer is the signed-in account behind a public content request; a coach
// running a club account gets no popups.
func (h *Handler) viewer(w http.ResponseWriter, r *http.Request) (string, bool, bool) {
	parts := strings.Fields(r.Header.Get("Authorization"))
	token := ""
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		token = parts[1]
	}
	u, err := h.auth.Me(r.Context(), token)
	if err != nil {
		failure(w, err)
		return "", false, false
	}
	return u.ID, u.Delegate != nil, true
}

// GET /v1/content/popup: {"popup": {...}} or {"popup": null}.
func (h *Handler) nextPopup(w http.ResponseWriter, r *http.Request) {
	id, delegated, ok := h.viewer(w, r)
	if !ok {
		return
	}
	var out *domain.ShownPopup
	if !delegated {
		var err error
		if out, err = h.service.NextPopup(r.Context(), id); err != nil {
			failure(w, err)
			return
		}
	}
	write(w, 200, map[string]any{"popup": out})
}

// POST /v1/content/popup/{id}/views: the app showed the popup.
func (h *Handler) popupViewed(w http.ResponseWriter, r *http.Request) {
	id, delegated, ok := h.viewer(w, r)
	if !ok {
		return
	}
	if !delegated {
		if err := h.service.RecordPopupView(r.Context(), r.PathValue("id"), id); err != nil {
			failure(w, err)
			return
		}
	}
	w.WriteHeader(204)
}

func (h *Handler) savePopup(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Title           string `json:"title"`
		ImageID         string `json:"imageId"`
		Active          bool   `json:"active"`
		IntervalMinutes int    `json:"intervalMinutes"`
		MaxViews        int    `json:"maxViews"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.SavePopup(r.Context(), domain.Popup{ID: r.PathValue("id"), Title: in.Title, ImageID: in.ImageID, Active: in.Active, IntervalMinutes: in.IntervalMinutes, MaxViews: in.MaxViews}, r.Method == "POST")
	if err != nil {
		failure(w, err)
		return
	}
	status := 200
	if r.Method == "POST" {
		status = 201
	}
	write(w, status, map[string]any{"popup": out})
}

func (h *Handler) registerAdminPopups(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/admin/content/popups", func(w http.ResponseWriter, r *http.Request) {
		out, err := h.service.Popups(r.Context(), page(r))
		if err != nil {
			failure(w, err)
			return
		}
		write(w, 200, out)
	})
	mux.HandleFunc("POST /v1/admin/content/popups", h.savePopup)
	mux.HandleFunc("PUT /v1/admin/content/popups/{id}", h.savePopup)
	mux.HandleFunc("DELETE /v1/admin/content/popups/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := h.service.DeletePopup(r.Context(), r.PathValue("id")); err != nil {
			failure(w, err)
			return
		}
		w.WriteHeader(204)
	})
}
