package application

import (
	"context"
	"strings"
	"unicode/utf8"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/teams/domain"
)

type Viewer struct{ ID, Role string }
type Service struct{ repo domain.Repository }

func New(repo domain.Repository) *Service { return &Service{repo: repo} }

type Team struct {
	ID                    string `json:"id"`
	Name                  string `json:"name"`
	FootballType          string `json:"footballType"`
	District              string `json:"district"`
	Description           string `json:"description"`
	VenueName             string `json:"venueName"`
	VenueAddress          string `json:"venueAddress"`
	TrainingGroundName    string `json:"trainingGroundName"`
	TrainingGroundAddress string `json:"trainingGroundAddress"`
	TrainingSchedule      string `json:"trainingSchedule"`
}

type Page struct {
	Items      []Team `json:"items"`
	Page       int    `json:"page"`
	PageSize   int    `json:"pageSize"`
	Total      int    `json:"total"`
	TotalPages int    `json:"totalPages"`
}

type Detail struct {
	Team          Team          `json:"team"`
	RequestStatus string        `json:"requestStatus"`
	Quota         *domain.Quota `json:"quota,omitempty"`
}

type RequestPage struct {
	Items      []domain.JoinRequest `json:"items"`
	Page       int                  `json:"page"`
	PageSize   int                  `json:"pageSize"`
	Total      int                  `json:"total"`
	TotalPages int                  `json:"totalPages"`
}

type PlayerApplicationPage struct {
	Items      []domain.TeamApplication `json:"items"`
	Page       int                      `json:"page"`
	PageSize   int                      `json:"pageSize"`
	Total      int                      `json:"total"`
	TotalPages int                      `json:"totalPages"`
	Quota      domain.Quota             `json:"quota"`
}

func teamDTO(value domain.Team) Team {
	return Team{ID: value.ID, Name: value.Name, FootballType: value.FootballType, District: value.District, Description: value.Description, VenueName: value.VenueName, VenueAddress: value.VenueAddress, TrainingGroundName: value.TrainingGroundName, TrainingGroundAddress: value.TrainingGroundAddress, TrainingSchedule: value.TrainingSchedule}
}

func (s *Service) List(ctx context.Context, query domain.Query) (Page, error) {
	query.Search = strings.TrimSpace(query.Search)
	if query.Page < 1 || query.Page > 1000000 || query.PageSize < 1 || query.PageSize > 50 || utf8.RuneCountInString(query.Search) > 100 {
		return Page{}, auth.ValidationError{"pagination": "Sayfa 1–1000000, sayfa boyutu 1–50 ve arama en fazla 100 karakter olmalı."}
	}
	page, err := s.repo.List(ctx, query)
	if err != nil {
		return Page{}, err
	}
	out := Page{Items: []Team{}, Page: query.Page, PageSize: query.PageSize, Total: page.Total, TotalPages: (page.Total + query.PageSize - 1) / query.PageSize}
	for _, value := range page.Items {
		out.Items = append(out.Items, teamDTO(value))
	}
	return out, nil
}

func (s *Service) Get(ctx context.Context, viewer Viewer, id string) (Detail, error) {
	value, err := s.repo.Get(ctx, id)
	if err != nil {
		return Detail{}, err
	}
	out := Detail{Team: teamDTO(value)}
	if viewer.Role == "player" {
		out.RequestStatus, err = s.repo.RequestStatus(ctx, viewer.ID, id)
		if err != nil {
			return Detail{}, err
		}
		quota, quotaErr := s.repo.Quota(ctx, viewer.ID)
		if quotaErr != nil {
			return Detail{}, quotaErr
		}
		out.Quota = &quota
	}
	return out, nil
}

func (s *Service) Request(ctx context.Context, viewer Viewer, teamID string) (domain.JoinRequest, domain.Quota, error) {
	if viewer.Role != "player" {
		return domain.JoinRequest{}, domain.Quota{}, domain.ErrForbidden
	}
	id, err := newID()
	if err != nil {
		return domain.JoinRequest{}, domain.Quota{}, err
	}
	return s.repo.CreateRequest(ctx, viewer.ID, teamID, id, "")
}

// RequestFromListing applies to a club through one of its open listings. It is
// an ordinary team application and uses one application right.
func (s *Service) RequestFromListing(ctx context.Context, viewer Viewer, clubID, listingID string) (domain.JoinRequest, domain.Quota, error) {
	if viewer.Role != "player" {
		return domain.JoinRequest{}, domain.Quota{}, domain.ErrForbidden
	}
	id, err := newID()
	if err != nil {
		return domain.JoinRequest{}, domain.Quota{}, err
	}
	return s.repo.CreateRequest(ctx, viewer.ID, clubID, id, listingID)
}

func (s *Service) Requests(ctx context.Context, viewer Viewer, status string, page, pageSize int) (RequestPage, error) {
	if viewer.Role != "club" {
		return RequestPage{}, domain.ErrForbidden
	}
	if status == "" {
		status = "pending"
	}
	if status != "pending" && status != "accepted" && status != "rejected" && status != "all" {
		return RequestPage{}, auth.ValidationError{"status": "Geçerli bir başvuru durumu seç."}
	}
	if page < 1 || page > 1000000 || pageSize < 1 || pageSize > 50 {
		return RequestPage{}, auth.ValidationError{"pagination": "Sayfa 1–1000000 ve sayfa boyutu 1–50 arasında olmalı."}
	}
	result, err := s.repo.ListRequests(ctx, viewer.ID, status, page, pageSize)
	if err != nil {
		return RequestPage{}, err
	}
	return RequestPage{Items: result.Items, Page: result.Page, PageSize: result.PageSize, Total: result.Total, TotalPages: result.TotalPages}, nil
}

func (s *Service) PlayerRequests(ctx context.Context, viewer Viewer, page, pageSize int) (PlayerApplicationPage, error) {
	if viewer.Role != "player" {
		return PlayerApplicationPage{}, domain.ErrForbidden
	}
	if page < 1 || page > 1000000 || pageSize < 1 || pageSize > 50 {
		return PlayerApplicationPage{}, auth.ValidationError{"pagination": "Sayfa 1–1000000 ve sayfa boyutu 1–50 arasında olmalı."}
	}
	result, quota, err := s.repo.PlayerRequests(ctx, viewer.ID, page, pageSize)
	if err != nil {
		return PlayerApplicationPage{}, err
	}
	return PlayerApplicationPage{Items: result.Items, Page: result.Page, PageSize: result.PageSize, Total: result.Total, TotalPages: result.TotalPages, Quota: quota}, nil
}

func (s *Service) Decide(ctx context.Context, viewer Viewer, requestID, decision string) (domain.JoinRequest, error) {
	if viewer.Role != "club" {
		return domain.JoinRequest{}, domain.ErrForbidden
	}
	if decision != "accepted" && decision != "rejected" {
		return domain.JoinRequest{}, auth.ValidationError{"decision": "Başvuruyu kabul et veya reddet."}
	}
	return s.repo.DecideRequest(ctx, viewer.ID, requestID, decision)
}
