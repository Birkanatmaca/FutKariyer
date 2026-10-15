package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"regexp"
	"strings"
	"time"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/gifts/domain"
)

type Service struct{ repo domain.Repository }

func New(repo domain.Repository) *Service { return &Service{repo: repo} }

var (
	validID    = regexp.MustCompile(`^[a-f0-9]{32}$`)
	emailShape = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
)

func newID() (string, error) {
	var v [16]byte
	if _, err := rand.Read(v[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(v[:]), nil
}

type CreateInput struct {
	Kind         string `json:"kind"`
	Title        string `json:"title"`
	Message      string `json:"message"`
	Audience     string `json:"audience"`
	Email        string `json:"email"`
	ValidityDays int    `json:"validityDays"`
}

// Create validates an admin campaign and sends it to every matching account.
func (s *Service) Create(ctx context.Context, in CreateInput) (domain.Gift, error) {
	fields := auth.ValidationError{}
	in.Title = strings.TrimSpace(in.Title)
	in.Message = strings.TrimSpace(in.Message)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	if !domain.ValidKind(in.Kind) {
		fields["kind"] = "Hediye türünü seç."
	}
	if n := len([]rune(in.Title)); n < 2 || n > 80 {
		fields["title"] = "Başlık 2-80 karakter olmalı."
	}
	if len([]rune(in.Message)) > 500 {
		fields["message"] = "Mesaj en fazla 500 karakter olabilir."
	}
	if in.ValidityDays < 1 || in.ValidityDays > domain.MaxValidityDays {
		fields["validityDays"] = "Geçerlilik 1-365 gün arasında olmalı."
	}
	switch in.Audience {
	case domain.AudienceAll:
		in.Email = ""
	case domain.AudienceAccount:
		if !emailShape.MatchString(in.Email) {
			fields["email"] = "Geçerli bir hesap e-postası gir."
		}
	default:
		fields["audience"] = "Alıcı seçimi geçersiz."
	}
	if len(fields) > 0 {
		return domain.Gift{}, fields
	}
	id, err := newID()
	if err != nil {
		return domain.Gift{}, err
	}
	gift := domain.Gift{ID: id, Kind: in.Kind, Title: in.Title, Message: in.Message, Audience: in.Audience, TargetEmail: in.Email, ValidityDays: in.ValidityDays}
	return s.repo.CreateGift(ctx, gift, in.Email)
}

func (s *Service) List(ctx context.Context) ([]domain.Gift, error) {
	return s.repo.ListGifts(ctx)
}

type MyGiftView struct {
	ID        string     `json:"id"`
	Kind      string     `json:"kind"`
	Title     string     `json:"title"`
	Message   string     `json:"message"`
	Status    string     `json:"status"`
	CreatedAt time.Time  `json:"createdAt"`
	ExpiresAt time.Time  `json:"expiresAt"`
	ClaimedAt *time.Time `json:"claimedAt"`
}

type Inbox struct {
	Items          []MyGiftView `json:"items"`
	AvailableCount int          `json:"availableCount"`
	ServerTime     time.Time    `json:"serverTime"`
}

func view(items []domain.MyGift, now time.Time) Inbox {
	out := Inbox{Items: []MyGiftView{}, ServerTime: now}
	for _, g := range items {
		status := g.Status(now)
		if status == domain.StatusAvailable {
			out.AvailableCount++
		}
		out.Items = append(out.Items, MyGiftView{ID: g.ID, Kind: g.Kind, Title: g.Title, Message: g.Message, Status: status, CreatedAt: g.CreatedAt, ExpiresAt: g.ExpiresAt, ClaimedAt: g.ClaimedAt})
	}
	return out
}

func (s *Service) Mine(ctx context.Context, userID string) (Inbox, error) {
	items, now, err := s.repo.MyGifts(ctx, userID)
	if err != nil {
		return Inbox{}, err
	}
	return view(items, now), nil
}

// Claim applies a gift once. Repeated claims of the same gift succeed without effect.
func (s *Service) Claim(ctx context.Context, userID, id string) (Inbox, string, error) {
	if !validID.MatchString(id) {
		return Inbox{}, "", domain.ErrNotFound
	}
	result, err := s.repo.Claim(ctx, userID, id)
	if err != nil {
		return Inbox{}, "", err
	}
	inbox, err := s.Mine(ctx, userID)
	outcome := "claimed"
	if result.AlreadyClaimed {
		outcome = "already_claimed"
	}
	return inbox, outcome, err
}
