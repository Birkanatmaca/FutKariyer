package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"regexp"
	"strings"
	"unicode/utf8"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/listings/domain"
	teams "futcareer/backend/internal/teams/application"
	teamdomain "futcareer/backend/internal/teams/domain"
)

var validID = regexp.MustCompile(`^[a-f0-9]{32}$`)

// Applications is the team application flow a listing application goes through.
type Applications interface {
	RequestFromListing(context.Context, teams.Viewer, string, string) (teamdomain.JoinRequest, teamdomain.Quota, error)
}

type Service struct {
	repo         domain.Repository
	applications Applications
}

func New(repo domain.Repository, applications Applications) *Service {
	return &Service{repo: repo, applications: applications}
}

type Input struct {
	Title       string `json:"title"`
	Position    string `json:"position"`
	Description string `json:"description"`
}

// Create publishes a club listing and notifies players of the same football type.
func (s *Service) Create(ctx context.Context, clubID string, in Input) (domain.Listing, int, error) {
	in.Title, in.Position, in.Description = strings.TrimSpace(in.Title), strings.TrimSpace(in.Position), strings.TrimSpace(in.Description)
	fields := auth.ValidationError{}
	if n := utf8.RuneCountInString(in.Title); n < 2 || n > 120 {
		fields["title"] = "Başlık 2-120 karakter olmalı."
	}
	if utf8.RuneCountInString(in.Position) > 40 {
		fields["position"] = "Mevki en fazla 40 karakter olabilir."
	}
	if utf8.RuneCountInString(in.Description) > 1000 {
		fields["description"] = "Açıklama en fazla 1000 karakter olabilir."
	}
	if len(fields) > 0 {
		return domain.Listing{}, 0, fields
	}
	var v [16]byte
	if _, err := rand.Read(v[:]); err != nil {
		return domain.Listing{}, 0, err
	}
	return s.repo.Create(ctx, domain.Listing{ID: hex.EncodeToString(v[:]), ClubID: clubID, Title: in.Title, Position: in.Position, Description: in.Description})
}

func (s *Service) Mine(ctx context.Context, clubID string) ([]domain.Listing, error) {
	return s.repo.Mine(ctx, clubID)
}

func (s *Service) Close(ctx context.Context, clubID, id string) (domain.Listing, error) {
	if !validID.MatchString(id) {
		return domain.Listing{}, domain.ErrNotFound
	}
	return s.repo.Close(ctx, clubID, id)
}

func (s *Service) Open(ctx context.Context, footballType string, page int) (domain.Page, error) {
	if footballType != "" && footballType != "amateur" && footballType != "professional" && footballType != "halisaha" {
		return domain.Page{}, auth.ValidationError{"footballType": "Futbol türü geçersiz."}
	}
	if page < 1 || page > 100000 {
		return domain.Page{}, auth.ValidationError{"page": "Sayfa numarası geçersiz."}
	}
	return s.repo.Open(ctx, footballType, page)
}

func (s *Service) Get(ctx context.Context, id string) (domain.Listing, error) {
	if !validID.MatchString(id) {
		return domain.Listing{}, domain.ErrNotFound
	}
	return s.repo.Get(ctx, id)
}

// Apply turns a listing application into a team application, which uses one right.
func (s *Service) Apply(ctx context.Context, playerID, listingID string) (teamdomain.JoinRequest, teamdomain.Quota, error) {
	listing, err := s.Get(ctx, listingID)
	if err != nil {
		return teamdomain.JoinRequest{}, teamdomain.Quota{}, err
	}
	return s.applications.RequestFromListing(ctx, teams.Viewer{ID: playerID, Role: "player"}, listing.ClubID, listing.ID)
}
