package application

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"futcareer/backend/internal/players/domain"
)

type ValidationError map[string]string

func (e ValidationError) Error() string { return "Profil bilgilerini kontrol edip tekrar dene." }

type Profile struct {
	Position        string `json:"position"`
	DominantFoot    string `json:"dominantFoot"`
	ExperienceYears int    `json:"experienceYears"`
	CurrentClub     string `json:"currentClub"`
	Availability    string `json:"availability"`
	Discoverable    bool   `json:"discoverable"`
	UpdatedAt       string `json:"updatedAt"`
}

type SaveInput struct {
	Position        string `json:"position"`
	DominantFoot    string `json:"dominantFoot"`
	ExperienceYears int    `json:"experienceYears"`
	CurrentClub     string `json:"currentClub"`
	Availability    string `json:"availability"`
	Discoverable    bool   `json:"discoverable"`
}

type Service struct {
	repo domain.Repository
	now  func() time.Time
}

func New(repo domain.Repository) *Service { return &Service{repo: repo, now: time.Now} }

func public(profile domain.Profile) Profile {
	return Profile{
		Position:        profile.Position,
		DominantFoot:    profile.DominantFoot,
		ExperienceYears: profile.ExperienceYears,
		CurrentClub:     profile.CurrentClub,
		Availability:    profile.Availability,
		Discoverable:    profile.Discoverable,
		UpdatedAt:       profile.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func (s *Service) Get(ctx context.Context, userID string) (Profile, error) {
	profile, err := s.repo.ProfileByUserID(ctx, userID)
	if errors.Is(err, domain.ErrNotFound) {
		return Profile{Availability: "not_available"}, nil
	}
	if err != nil {
		return Profile{}, err
	}
	return public(profile), nil
}

func (s *Service) Save(ctx context.Context, userID string, in SaveInput) (Profile, error) {
	in.Position = strings.TrimSpace(in.Position)
	in.DominantFoot = strings.TrimSpace(in.DominantFoot)
	in.CurrentClub = strings.TrimSpace(in.CurrentClub)
	fields := ValidationError{}
	if utf8.RuneCountInString(in.Position) > 40 {
		fields["position"] = "Mevki en fazla 40 karakter olabilir."
	}
	if in.DominantFoot != "" && in.DominantFoot != "right" && in.DominantFoot != "left" && in.DominantFoot != "both" {
		fields["dominantFoot"] = "Baskın ayak seçeneklerinden birini seç."
	}
	if in.ExperienceYears < 0 || in.ExperienceYears > 60 {
		fields["experienceYears"] = "Futbol deneyimi 0–60 yıl arasında olmalı."
	}
	if utf8.RuneCountInString(in.CurrentClub) > 100 {
		fields["currentClub"] = "Kulüp adı en fazla 100 karakter olabilir."
	}
	if in.Availability != "seeking_team" && in.Availability != "open_to_offers" && in.Availability != "not_available" {
		fields["availability"] = "Uygunluk seçeneklerinden birini seç."
	}
	if len(fields) > 0 {
		return Profile{}, fields
	}
	profile := domain.Profile{
		UserID:          userID,
		Position:        in.Position,
		DominantFoot:    in.DominantFoot,
		ExperienceYears: in.ExperienceYears,
		CurrentClub:     in.CurrentClub,
		Availability:    in.Availability,
		Discoverable:    in.Discoverable,
		UpdatedAt:       s.now().UTC(),
	}
	if err := s.repo.SaveProfile(ctx, profile); err != nil {
		return Profile{}, err
	}
	return public(profile), nil
}
