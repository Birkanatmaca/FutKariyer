package application

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/content/domain"
	"image"
	"image/jpeg"
	"image/png"
	"strings"
	"time"
	"unicode/utf8"
)

const MaxImageBytes = 4 * 1024 * 1024

type Service struct{ repo domain.Repository }

func New(repo domain.Repository) *Service { return &Service{repo: repo} }
func newID() (string, error) {
	var b [16]byte
	_, err := rand.Read(b[:])
	return hex.EncodeToString(b[:]), err
}
func (s *Service) Upload(ctx context.Context, data []byte) (string, error) {
	invalid := auth.ValidationError{"image": "Geçerli bir JPEG/PNG görsel seç. En fazla 4 MiB ve 16 milyon piksel olmalı."}
	if len(data) == 0 || len(data) > MaxImageBytes {
		return "", invalid
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || (format != "jpeg" && format != "png") || cfg.Width < 1 || cfg.Height < 1 || cfg.Width > 8192 || cfg.Height > 8192 || int64(cfg.Width)*int64(cfg.Height) > 16000000 {
		return "", invalid
	}
	decoded, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return "", invalid
	}
	var clean bytes.Buffer
	mime := "image/png"
	if format == "jpeg" {
		mime = "image/jpeg"
		err = jpeg.Encode(&clean, decoded, &jpeg.Options{Quality: 85})
	} else {
		err = png.Encode(&clean, decoded)
	}
	if err != nil || clean.Len() > MaxImageBytes {
		return "", invalid
	}
	id, err := newID()
	if err != nil {
		return "", err
	}
	err = s.repo.SaveImage(ctx, domain.Image{ID: id, MIME: mime, Data: clean.Bytes()})
	return id, err
}
func (s *Service) Image(ctx context.Context, id string, admin bool) (domain.Image, error) {
	return s.repo.Image(ctx, id, admin)
}
func validPage(page int) error {
	if page < 1 || page > 1000000 {
		return auth.ValidationError{"page": "Geçerli bir sayfa seç."}
	}
	return nil
}
func (s *Service) Ads(ctx context.Context, admin bool, page int) (domain.Page[domain.Advertisement], error) {
	if err := validPage(page); err != nil {
		return domain.Page[domain.Advertisement]{}, err
	}
	return s.repo.Ads(ctx, admin, page)
}
func (s *Service) News(ctx context.Context, admin, home bool, page int) (domain.Page[domain.Article], error) {
	if err := validPage(page); err != nil {
		return domain.Page[domain.Article]{}, err
	}
	return s.repo.News(ctx, admin, home, page)
}
func (s *Service) Article(ctx context.Context, id string, admin bool) (domain.Article, error) {
	return s.repo.Article(ctx, id, admin)
}
func (s *Service) Home(ctx context.Context) (domain.Home, error) {
	ads, err := s.repo.Ads(ctx, false, 1)
	if err != nil {
		return domain.Home{}, err
	}
	news, err := s.repo.News(ctx, false, true, 1)
	if err != nil {
		return domain.Home{}, err
	}
	return domain.Home{Advertisements: ads.Items, News: news.Items}, nil
}

// scheduleErrors checks the carousel time and the publishing window. A zero
// display time takes the default, so older clients keep working.
func scheduleErrors(in *domain.Schedule, fallback int, fields auth.ValidationError) {
	if in.DisplaySeconds == 0 {
		in.DisplaySeconds = fallback
	}
	if in.DisplaySeconds < domain.MinDisplaySeconds || in.DisplaySeconds > domain.MaxDisplaySeconds {
		fields["displaySeconds"] = "Ekranda kalma süresi 3–30 saniye olmalı."
	}
	windowErrors(in.StartsAt, in.EndsAt, fields)
}
func windowErrors(starts, ends *time.Time, fields auth.ValidationError) {
	if starts != nil && ends != nil && !ends.After(*starts) {
		fields["endsAt"] = "Bitiş, başlangıçtan sonra olmalı."
	}
}
func text(value string, min, max int) bool {
	n := utf8.RuneCountInString(value)
	return n >= min && n <= max
}
func (s *Service) SaveAd(ctx context.Context, in domain.Advertisement, create bool) (domain.Advertisement, error) {
	in.Title = strings.TrimSpace(in.Title)
	fields := auth.ValidationError{}
	if !text(in.Title, 2, 120) {
		fields["title"] = "Başlık 2–120 karakter olmalı."
	}
	if in.ImageID == "" {
		fields["image"] = "Bir reklam görseli yükle."
	}
	if in.SortOrder < 0 || in.SortOrder > 10000 {
		fields["sortOrder"] = "Sıra 0–10000 arasında olmalı."
	}
	scheduleErrors(&in.Schedule, 5, fields)
	if len(fields) > 0 {
		return in, fields
	}
	if _, err := s.repo.Image(ctx, in.ImageID, true); err != nil {
		if errors.Is(err, authdomain.ErrNotFound) {
			return in, auth.ValidationError{"image": "Yüklenen görsel bulunamadı."}
		}
		return in, err
	}
	if create {
		id, err := newID()
		if err != nil {
			return in, err
		}
		in.ID = id
	}
	return s.repo.SaveAd(ctx, in, create)
}
func (s *Service) SaveArticle(ctx context.Context, in domain.Article, create bool) (domain.Article, error) {
	in.Title = strings.TrimSpace(in.Title)
	in.Summary = strings.TrimSpace(in.Summary)
	in.Body = strings.TrimSpace(in.Body)
	fields := auth.ValidationError{}
	if !text(in.Title, 2, 120) {
		fields["title"] = "Başlık 2–120 karakter olmalı."
	}
	if !text(in.Summary, 2, 300) {
		fields["summary"] = "Özet 2–300 karakter olmalı."
	}
	if !text(in.Body, 2, 20000) {
		fields["body"] = "Haber metni 2–20000 karakter olmalı."
	}
	if in.SortOrder < 0 || in.SortOrder > 10000 {
		fields["sortOrder"] = "Öncelik 0–10000 arasında olmalı."
	}
	scheduleErrors(&in.Schedule, 6, fields)
	if in.ImageID != "" {
		if _, err := s.repo.Image(ctx, in.ImageID, true); err != nil {
			if !errors.Is(err, authdomain.ErrNotFound) {
				return in, err
			}
			fields["image"] = "Yüklenen görsel bulunamadı."
		}
	}
	if len(fields) > 0 {
		return in, fields
	}
	if create {
		id, err := newID()
		if err != nil {
			return in, err
		}
		in.ID = id
	}
	return s.repo.SaveArticle(ctx, in, create)
}
func (s *Service) DeleteAd(ctx context.Context, id string) error { return s.repo.DeleteAd(ctx, id) }
func (s *Service) DeleteArticle(ctx context.Context, id string) error {
	return s.repo.DeleteArticle(ctx, id)
}

// SubmitClubArticle validates a club article. Clubs cannot attach images or
// publish directly; the article waits for administrator approval.
func (s *Service) SubmitClubArticle(ctx context.Context, authorID string, in domain.Article) (domain.Article, error) {
	in.Title = strings.TrimSpace(in.Title)
	in.Summary = strings.TrimSpace(in.Summary)
	in.Body = strings.TrimSpace(in.Body)
	fields := auth.ValidationError{}
	if !text(in.Title, 2, 120) {
		fields["title"] = "Başlık 2–120 karakter olmalı."
	}
	if !text(in.Summary, 2, 300) {
		fields["summary"] = "Özet 2–300 karakter olmalı."
	}
	if !text(in.Body, 2, 20000) {
		fields["body"] = "Haber metni 2–20000 karakter olmalı."
	}
	if len(fields) > 0 {
		return in, fields
	}
	id, err := newID()
	if err != nil {
		return in, err
	}
	in.ID = id
	return s.repo.SubmitClubArticle(ctx, authorID, in)
}

func (s *Service) ClubArticles(ctx context.Context, authorID string) ([]domain.Article, error) {
	return s.repo.ClubArticles(ctx, authorID)
}

// ReviewClubArticle applies an administrator decision to a pending club article.
func (s *Service) ReviewClubArticle(ctx context.Context, id, decision string) (domain.Article, error) {
	if decision != "approve" && decision != "reject" {
		return domain.Article{}, auth.ValidationError{"decision": "Karar approve veya reject olmalı."}
	}
	return s.repo.ReviewClubArticle(ctx, id, decision == "approve")
}

func (s *Service) PendingClubArticles(ctx context.Context) ([]domain.Article, error) {
	return s.repo.PendingClubArticles(ctx)
}
