package application

import (
	"bytes"
	"context"
	"errors"
	"image"
	"regexp"
	"strings"

	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/content/domain"
)

var popupID = regexp.MustCompile(`^[0-9a-f]{32}$`)

func (s *Service) Popups(ctx context.Context, page int) (domain.Page[domain.Popup], error) {
	if err := validPage(page); err != nil {
		return domain.Page[domain.Popup]{}, err
	}
	return s.repo.Popups(ctx, page)
}

// SavePopup checks the admin's input and takes the format from the image's
// exact size: 1080×1080 square, 1080×1350 portrait or 1080×1920 full screen.
func (s *Service) SavePopup(ctx context.Context, in domain.Popup, create bool) (domain.Popup, error) {
	in.Title = strings.TrimSpace(in.Title)
	fields := auth.ValidationError{}
	if !text(in.Title, 2, 120) {
		fields["title"] = "Başlık 2–120 karakter olmalı."
	}
	if in.ImageID == "" {
		fields["image"] = "Bir popup görseli yükle."
	}
	if in.IntervalMinutes < domain.MinPopupInterval || in.IntervalMinutes > domain.MaxPopupInterval {
		fields["intervalMinutes"] = "Gösterim aralığı 1 dakika ile 30 gün (43200 dakika) arasında olmalı."
	}
	if in.MaxViews < domain.MinPopupViews || in.MaxViews > domain.MaxPopupViews {
		fields["maxViews"] = "Gösterim sayısı 1–100 arasında olmalı."
	}
	if len(fields) > 0 {
		return in, fields
	}
	img, err := s.repo.Image(ctx, in.ImageID, true)
	if errors.Is(err, authdomain.ErrNotFound) {
		return in, auth.ValidationError{"image": "Yüklenen görsel bulunamadı."}
	}
	if err != nil {
		return in, err
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(img.Data))
	format, ok := domain.PopupFormatFor(cfg.Width, cfg.Height)
	if err != nil || !ok {
		return in, auth.ValidationError{"image": "Görsel 1080×1080 (kare), 1080×1350 (dikey) veya 1080×1920 (tam ekran) piksel olmalı."}
	}
	in.Format = format
	if create {
		if in.ID, err = newID(); err != nil {
			return in, err
		}
	} else if !popupID.MatchString(in.ID) {
		return in, authdomain.ErrNotFound
	}
	return s.repo.SavePopup(ctx, in, create)
}

func (s *Service) DeletePopup(ctx context.Context, id string) error {
	if !popupID.MatchString(id) {
		return authdomain.ErrNotFound
	}
	return s.repo.DeletePopup(ctx, id)
}

// NextPopup is the popup to show this account when the app opens, or nil.
func (s *Service) NextPopup(ctx context.Context, userID string) (*domain.ShownPopup, error) {
	out, ok, err := s.repo.NextPopup(ctx, userID)
	if err != nil || !ok {
		return nil, err
	}
	return &out, nil
}

func (s *Service) RecordPopupView(ctx context.Context, id, userID string) error {
	if !popupID.MatchString(id) {
		return authdomain.ErrNotFound
	}
	return s.repo.RecordPopupView(ctx, id, userID)
}
