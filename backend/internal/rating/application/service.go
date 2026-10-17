package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"regexp"
	"strings"
	"time"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/rating/domain"
)

type Service struct{ repo domain.Repository }

func New(repo domain.Repository) *Service { return &Service{repo: repo} }

var validID = regexp.MustCompile(`^[a-f0-9]{32}$`)

// Seasons may run up to 92 days; the product plans monthly ones.
const maxSeasonLength = 92 * 24 * time.Hour

func newID() (string, error) {
	var v [16]byte
	if _, err := rand.Read(v[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(v[:]), nil
}

type SeasonInput struct {
	Title       string         `json:"title"`
	Description string         `json:"description"`
	StartsAt    time.Time      `json:"startsAt"`
	EndsAt      time.Time      `json:"endsAt"`
	Prizes      []domain.Prize `json:"prizes"`
	Published   bool           `json:"published"`
}

func (in SeasonInput) season(id string) (domain.Season, error) {
	fields := auth.ValidationError{}
	in.Title = strings.TrimSpace(in.Title)
	in.Description = strings.TrimSpace(in.Description)
	if n := len([]rune(in.Title)); n < 2 || n > 80 {
		fields["title"] = "Başlık 2-80 karakter olmalı."
	}
	if len([]rune(in.Description)) > 500 {
		fields["description"] = "Açıklama en fazla 500 karakter olabilir."
	}
	if in.StartsAt.IsZero() || in.EndsAt.IsZero() || !in.EndsAt.After(in.StartsAt) {
		fields["endsAt"] = "Bitiş, başlangıçtan sonra olmalı."
	} else if in.EndsAt.Sub(in.StartsAt) > maxSeasonLength {
		fields["endsAt"] = "Bir sezon en fazla 92 gün sürebilir."
	}
	prizes := []domain.Prize{}
	seen := map[int]bool{}
	if len(in.Prizes) > domain.PrizePlaces {
		fields["prizes"] = "En fazla ilk üç sıra için ödül girilebilir."
	}
	for _, p := range in.Prizes {
		p.Title = strings.TrimSpace(p.Title)
		if p.Place < 1 || p.Place > domain.PrizePlaces || seen[p.Place] {
			fields["prizes"] = "Ödüller 1., 2. ve 3. sıra için birer kez girilebilir."
			continue
		}
		seen[p.Place] = true
		if p.Title == "" {
			continue
		}
		if len([]rune(p.Title)) > 120 {
			fields["prizes"] = "Ödül açıklaması en fazla 120 karakter olabilir."
			continue
		}
		prizes = append(prizes, p)
	}
	if len(fields) > 0 {
		return domain.Season{}, fields
	}
	return domain.Season{ID: id, Title: in.Title, Description: in.Description, StartsAt: in.StartsAt.UTC(), EndsAt: in.EndsAt.UTC(), Prizes: prizes, Published: in.Published}, nil
}

func (s *Service) Board(ctx context.Context, userID string) (domain.Board, error) {
	return s.repo.Board(ctx, userID)
}

func (s *Service) ClaimTask(ctx context.Context, userID, kind string) (domain.Board, error) {
	if !domain.ValidTaskKind(kind) {
		return domain.Board{}, domain.ErrNotFound
	}
	return s.repo.ClaimTask(ctx, userID, kind)
}

func (s *Service) Seasons(ctx context.Context) ([]domain.Season, time.Time, error) {
	return s.repo.Seasons(ctx)
}

func (s *Service) CreateSeason(ctx context.Context, in SeasonInput) (domain.Season, error) {
	id, err := newID()
	if err != nil {
		return domain.Season{}, err
	}
	season, err := in.season(id)
	if err != nil {
		return season, err
	}
	return s.repo.CreateSeason(ctx, season)
}

func (s *Service) UpdateSeason(ctx context.Context, id string, in SeasonInput) (domain.Season, error) {
	if !validID.MatchString(id) {
		return domain.Season{}, domain.ErrNotFound
	}
	season, err := in.season(id)
	if err != nil {
		return season, err
	}
	return s.repo.UpdateSeason(ctx, season)
}

func (s *Service) DeleteSeason(ctx context.Context, id string) error {
	if !validID.MatchString(id) {
		return domain.ErrNotFound
	}
	return s.repo.DeleteSeason(ctx, id)
}

func (s *Service) SeasonBoard(ctx context.Context, id string) (domain.Season, []domain.Standing, error) {
	if !validID.MatchString(id) {
		return domain.Season{}, nil, domain.ErrNotFound
	}
	return s.repo.SeasonBoard(ctx, id)
}

func (s *Service) Tasks(ctx context.Context) ([]domain.Task, error) {
	return s.repo.Tasks(ctx)
}

type TaskInput struct {
	Active bool `json:"active"`
	Target int  `json:"target"`
	Points int  `json:"points"`
}

func (s *Service) UpdateTask(ctx context.Context, kind string, in TaskInput) (domain.Task, error) {
	if !domain.ValidTaskKind(kind) {
		return domain.Task{}, domain.ErrNotFound
	}
	fields := auth.ValidationError{}
	if in.Target < 1 || in.Target > 100 {
		fields["target"] = "Hedef 1-100 arasında olmalı."
	}
	if in.Points < 1 || in.Points > 1000 {
		fields["points"] = "Puan 1-1000 arasında olmalı."
	}
	if len(fields) > 0 {
		return domain.Task{}, fields
	}
	return s.repo.UpdateTask(ctx, domain.Task{Kind: kind, Active: in.Active, Target: in.Target, Points: in.Points})
}
