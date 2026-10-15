package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"regexp"
	"strings"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/notifications/domain"
)

var (
	emailShape = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
	audiences  = map[string]bool{"all": true, "player": true, "club": true, "coach": true, "account": true}
)

type AnnouncementInput struct {
	Title    string `json:"title"`
	Body     string `json:"body"`
	Audience string `json:"audience"`
	Email    string `json:"email"`
}

type AnnouncementService struct{ repo domain.AnnouncementRepository }

func NewAnnouncements(repo domain.AnnouncementRepository) *AnnouncementService {
	return &AnnouncementService{repo: repo}
}

func (s *AnnouncementService) Create(ctx context.Context, in AnnouncementInput) (domain.Announcement, error) {
	fields := auth.ValidationError{}
	in.Title = strings.TrimSpace(in.Title)
	in.Body = strings.TrimSpace(in.Body)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	if n := len([]rune(in.Title)); n < 2 || n > 120 {
		fields["title"] = "Başlık 2-120 karakter olmalı."
	}
	if n := len([]rune(in.Body)); n < 1 || n > 500 {
		fields["body"] = "Metin 1-500 karakter olmalı."
	}
	if !audiences[in.Audience] {
		fields["audience"] = "Alıcı seçimi geçersiz."
	}
	if in.Audience == "account" && !emailShape.MatchString(in.Email) {
		fields["email"] = "Geçerli bir hesap e-postası gir."
	}
	if in.Audience != "account" {
		in.Email = ""
	}
	if len(fields) > 0 {
		return domain.Announcement{}, fields
	}
	var v [16]byte
	if _, err := rand.Read(v[:]); err != nil {
		return domain.Announcement{}, err
	}
	a := domain.Announcement{ID: hex.EncodeToString(v[:]), Kind: domain.KindOpportunity, Title: in.Title, Body: in.Body, Audience: in.Audience, TargetEmail: in.Email}
	return s.repo.CreateAnnouncement(ctx, a, in.Email)
}

func (s *AnnouncementService) List(ctx context.Context) ([]domain.Announcement, error) {
	return s.repo.ListAnnouncements(ctx)
}
