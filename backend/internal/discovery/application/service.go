package application

import (
	"context"
	"strings"
	"unicode/utf8"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/discovery/domain"
	players "futcareer/backend/internal/players/application"
)

type Service struct{ repo domain.Repository }

func New(repo domain.Repository) *Service { return &Service{repo: repo} }

type Profile struct {
	ID            string           `json:"id"`
	FullName      string           `json:"fullName"`
	Role          string           `json:"role"`
	Verified      bool             `json:"verified"`
	IsPro         bool             `json:"isPro"`
	District      string           `json:"district"`
	PlayerProfile *players.Profile `json:"playerProfile"`
	IsFollowing   bool             `json:"isFollowing"`
}

type Page struct {
	Items      []Profile `json:"items"`
	Page       int       `json:"page"`
	PageSize   int       `json:"pageSize"`
	Total      int       `json:"total"`
	TotalPages int       `json:"totalPages"`
}

func authorize(viewer domain.Viewer, role string) error {
	if role != "player" && role != "club" && role != "coach" {
		return auth.ValidationError{"role": "Geçerli bir keşif bölümü seç."}
	}
	if viewer.Role == "player" {
		return nil
	}
	if (viewer.Role == "club" || viewer.Role == "coach") && role == "player" {
		if !viewer.Verified {
			return domain.ErrVerificationRequired
		}
		return nil
	}
	return domain.ErrForbidden
}

func dto(profile domain.Profile) Profile {
	result := Profile{ID: profile.ID, FullName: profile.FullName, Role: profile.Role, Verified: profile.Verified, IsPro: profile.IsPro, District: profile.District}
	if profile.PlayerProfile != nil {
		player := players.Public(*profile.PlayerProfile)
		result.PlayerProfile = &player
	}
	return result
}

func (s *Service) List(ctx context.Context, viewer domain.Viewer, q domain.Query) (Page, error) {
	if err := authorize(viewer, q.Role); err != nil {
		return Page{}, err
	}
	q.Search = strings.TrimSpace(q.Search)
	q.Position = strings.TrimSpace(q.Position)
	q.ViewerID = viewer.ID
	fields := auth.ValidationError{}
	if q.Page < 1 || q.Page > 1000000 || q.PageSize < 1 || q.PageSize > 50 {
		fields["pagination"] = "Sayfa 1–1000000 ve sayfa boyutu 1–50 arasında olmalı."
	}
	if utf8.RuneCountInString(q.Search) > 100 {
		fields["search"] = "Arama en fazla 100 karakter olmalı."
	}
	if utf8.RuneCountInString(q.Position) > 40 {
		fields["position"] = "Mevki en fazla 40 karakter olmalı."
	}
	if q.DominantFoot != "" && q.DominantFoot != "right" && q.DominantFoot != "left" && q.DominantFoot != "both" {
		fields["dominantFoot"] = "Geçerli bir baskın ayak seç."
	}
	if q.Availability != "" && q.Availability != "seeking_team" && q.Availability != "open_to_offers" && q.Availability != "not_available" {
		fields["availability"] = "Geçerli bir uygunluk durumu seç."
	}
	if q.FootballType != "" && q.FootballType != "amateur" && q.FootballType != "professional" && q.FootballType != "halisaha" {
		fields["footballType"] = "Geçerli bir futbol türü seç."
	}
	if q.LicenseStatus != "" && q.LicenseStatus != "licensed" && q.LicenseStatus != "unlicensed" {
		fields["licenseStatus"] = "Geçerli bir lisans durumu seç."
	}
	if q.Role != "player" && (q.Position != "" || q.DominantFoot != "" || q.Availability != "" || q.FootballType != "" || q.LicenseStatus != "") {
		fields["filters"] = "Futbol filtreleri yalnızca oyuncu aramasında kullanılabilir."
	}
	if len(fields) != 0 {
		return Page{}, fields
	}
	page, err := s.repo.List(ctx, q)
	if err != nil {
		return Page{}, err
	}
	result := Page{Items: []Profile{}, Page: q.Page, PageSize: q.PageSize, Total: page.Total, TotalPages: (page.Total + q.PageSize - 1) / q.PageSize}
	for _, profile := range page.Items {
		result.Items = append(result.Items, dto(profile))
	}
	return result, nil
}

func (s *Service) Get(ctx context.Context, viewer domain.Viewer, role, id string) (Profile, error) {
	if err := authorize(viewer, role); err != nil {
		return Profile{}, err
	}
	if viewer.ID == id {
		return Profile{}, domain.ErrForbidden
	}
	profile, err := s.repo.Get(ctx, role, id, viewer.ID)
	if err != nil {
		return Profile{}, err
	}
	if err = s.repo.RecordView(ctx, role, id, viewer.ID); err != nil {
		return Profile{}, err
	}
	result := dto(profile)
	result.IsFollowing, err = s.repo.Following(ctx, id, viewer.ID)
	return result, err
}

func (s *Service) Follow(ctx context.Context, viewer domain.Viewer, role, id string, following bool) error {
	if err := authorize(viewer, role); err != nil {
		return err
	}
	if id == viewer.ID {
		return domain.ErrForbidden
	}
	return s.repo.Follow(ctx, role, id, viewer.ID, following)
}
func (s *Service) Insights(ctx context.Context, viewer domain.Viewer) (domain.Insights, error) {
	return s.repo.Insights(ctx, viewer.ID)
}
