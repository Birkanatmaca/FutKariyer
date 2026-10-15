package application

import (
	"context"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"futcareer/backend/internal/admin/domain"
	auth "futcareer/backend/internal/auth/application"
	authdomain "futcareer/backend/internal/auth/domain"
	clubs "futcareer/backend/internal/clubs/domain"
)

type Service struct{ repo domain.Repository }

func New(repo domain.Repository) *Service { return &Service{repo: repo} }

type Account struct {
	auth.PublicUser
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
	Items      []Account `json:"items"`
	Page       int       `json:"page"`
	PageSize   int       `json:"pageSize"`
	Total      int       `json:"total"`
	TotalPages int       `json:"totalPages"`
}
type CreateInput struct {
	auth.AccountInput
	FootballType          string `json:"footballType"`
	District              string `json:"district"`
	Description           string `json:"description"`
	VenueName             string `json:"venueName"`
	VenueAddress          string `json:"venueAddress"`
	TrainingGroundName    string `json:"trainingGroundName"`
	TrainingGroundAddress string `json:"trainingGroundAddress"`
	TrainingSchedule      string `json:"trainingSchedule"`
}
type UpdateInput struct {
	FullName              string `json:"fullName"`
	FootballType          string `json:"footballType"`
	Email                 string `json:"email"`
	Username              string `json:"username"`
	District              string `json:"district"`
	Description           string `json:"description"`
	VenueName             string `json:"venueName"`
	VenueAddress          string `json:"venueAddress"`
	TrainingGroundName    string `json:"trainingGroundName"`
	TrainingGroundAddress string `json:"trainingGroundAddress"`
	TrainingSchedule      string `json:"trainingSchedule"`
	Active                *bool  `json:"active"`
	Verified              *bool  `json:"verified"`
}

func dto(record domain.Record) Account {
	result := Account{PublicUser: auth.Public(record.User)}
	if record.Club != nil {
		result.FootballType = record.Club.FootballType
		result.District = record.Club.District
		result.Description = record.Club.Description
		result.VenueName = record.Club.VenueName
		result.VenueAddress = record.Club.VenueAddress
		result.TrainingGroundName = record.Club.TrainingGroundName
		result.TrainingGroundAddress = record.Club.TrainingGroundAddress
		result.TrainingSchedule = record.Club.TrainingSchedule
	}
	return result
}
func (s *Service) List(ctx context.Context, q domain.Query) (Page, error) {
	if q.Page < 1 || q.Page > 1000000 || q.PageSize < 1 || q.PageSize > 100 || utf8.RuneCountInString(q.Search) > 100 {
		return Page{}, auth.ValidationError{"pagination": "Sayfa 1–1000000, sayfa boyutu 1–100 ve arama en fazla 100 karakter olmalı."}
	}
	q.Search = strings.TrimSpace(q.Search)
	page, err := s.repo.List(ctx, q)
	if err != nil {
		return Page{}, err
	}
	result := Page{Items: []Account{}, Page: q.Page, PageSize: q.PageSize, Total: page.Total, TotalPages: (page.Total + q.PageSize - 1) / q.PageSize}
	for _, record := range page.Items {
		result.Items = append(result.Items, dto(record))
	}
	return result, nil
}
func (s *Service) record(ctx context.Context, id string, clubOnly bool) (domain.Record, error) {
	record, err := s.repo.Get(ctx, id)
	if err == nil && clubOnly && record.User.Role != "club" {
		return domain.Record{}, authdomain.ErrNotFound
	}
	return record, err
}
func (s *Service) Get(ctx context.Context, id string, clubOnly bool) (Account, error) {
	record, err := s.record(ctx, id, clubOnly)
	return dto(record), err
}
func (s *Service) Create(ctx context.Context, in CreateInput, clubOnly bool) (Account, error) {
	if clubOnly {
		in.Role = "club"
	} else if in.Role != "player" && in.Role != "coach" && in.Role != "organizer" {
		return Account{}, auth.ValidationError{"role": "Bu bölümde sporcu, antrenör veya organizasyon oluşturabilirsin. Kulüp için kulüpler bölümünü kullan."}
	}
	in.District = strings.TrimSpace(in.District)
	if clubOnly {
		if !validFootballType(in.FootballType) {
			return Account{}, auth.ValidationError{"footballType": "Takım türünü seç."}
		}
		if fields := ClubFieldErrors(in.District, in.Description, in.VenueName, in.VenueAddress, in.TrainingGroundName, in.TrainingGroundAddress, in.TrainingSchedule); len(fields) > 0 {
			return Account{}, fields
		}
	}
	u, err := auth.PrepareAccount(in.AccountInput)
	if err != nil {
		return Account{}, err
	}
	record := domain.Record{User: u}
	if clubOnly {
		record.Club = &clubs.Club{UserID: u.ID, FootballType: in.FootballType, District: in.District, Description: strings.TrimSpace(in.Description), VenueName: strings.TrimSpace(in.VenueName), VenueAddress: strings.TrimSpace(in.VenueAddress), TrainingGroundName: strings.TrimSpace(in.TrainingGroundName), TrainingGroundAddress: strings.TrimSpace(in.TrainingGroundAddress), TrainingSchedule: strings.TrimSpace(in.TrainingSchedule), UpdatedAt: time.Now().UTC()}
	}
	if err = s.repo.Create(ctx, record); err != nil {
		return Account{}, err
	}
	return dto(record), nil
}
func (s *Service) Update(ctx context.Context, id string, in UpdateInput, clubOnly bool) (Account, error) {
	record, err := s.record(ctx, id, clubOnly)
	if err != nil {
		return Account{}, err
	}
	if record.User.Role == "admin" {
		return Account{}, domain.ErrProtected
	}
	normalized, fields := auth.ValidateAccount(auth.AccountInput{FullName: in.FullName, Email: in.Email, Username: in.Username, Role: record.User.Role})
	in.District = strings.TrimSpace(in.District)
	in.Description = strings.TrimSpace(in.Description)
	in.VenueName = strings.TrimSpace(in.VenueName)
	in.VenueAddress = strings.TrimSpace(in.VenueAddress)
	in.TrainingGroundName = strings.TrimSpace(in.TrainingGroundName)
	in.TrainingGroundAddress = strings.TrimSpace(in.TrainingGroundAddress)
	in.TrainingSchedule = strings.TrimSpace(in.TrainingSchedule)
	if in.Active == nil {
		fields["active"] = "Hesap erişim durumunu seç."
	}
	if record.Club != nil {
		if !validFootballType(in.FootballType) {
			fields["footballType"] = "Takım türünü seç."
		}
		for key, value := range ClubFieldErrors(in.District, in.Description, in.VenueName, in.VenueAddress, in.TrainingGroundName, in.TrainingGroundAddress, in.TrainingSchedule) {
			fields[key] = value
		}
	}
	if in.Verified != nil && *in.Verified && record.User.Role != "club" && record.User.Role != "coach" && record.User.Role != "organizer" {
		fields["verified"] = "Yalnızca kulüp, antrenör ve organizasyon hesapları doğrulanabilir."
	}
	if len(fields) > 0 {
		return Account{}, fields
	}
	record.User.FullName = normalized.FullName
	record.User.Email = normalized.Email
	record.User.Username = normalized.Username
	record.User.Active = *in.Active
	if in.Verified != nil {
		record.User.Verified = *in.Verified
	}
	if record.Club != nil {
		record.Club.FootballType = in.FootballType
		record.Club.District = in.District
		record.Club.Description = in.Description
		record.Club.VenueName = in.VenueName
		record.Club.VenueAddress = in.VenueAddress
		record.Club.TrainingGroundName = in.TrainingGroundName
		record.Club.TrainingGroundAddress = in.TrainingGroundAddress
		record.Club.TrainingSchedule = in.TrainingSchedule
		record.Club.UpdatedAt = time.Now().UTC()
	}
	if err = s.repo.Update(ctx, record); err != nil {
		return Account{}, err
	}
	return dto(record), nil
}

func validFootballType(value string) bool {
	return value == "amateur" || value == "professional" || value == "halisaha"
}

func ClubFieldErrors(district, description, venueName, venueAddress, trainingName, trainingAddress, schedule string) auth.ValidationError {
	values := map[string]struct {
		value string
		limit int
		label string
	}{
		"district": {district, 80, "İlçe"}, "description": {description, 1000, "Tanıtım"},
		"venueName": {venueName, 120, "Maç sahası"}, "venueAddress": {venueAddress, 240, "Maç sahası adresi"},
		"trainingGroundName": {trainingName, 120, "Antrenman sahası"}, "trainingGroundAddress": {trainingAddress, 240, "Antrenman adresi"},
		"trainingSchedule": {schedule, 240, "Antrenman programı"},
	}
	fields := auth.ValidationError{}
	for key, field := range values {
		if utf8.RuneCountInString(field.value) > field.limit {
			fields[key] = field.label + " en fazla " + strconv.Itoa(field.limit) + " karakter olmalı."
		}
	}
	return fields
}
func (s *Service) Delete(ctx context.Context, id string, clubOnly bool) error {
	if _, err := s.record(ctx, id, clubOnly); err != nil {
		return err
	}
	return s.repo.Delete(ctx, id)
}
func (s *Service) ResetPassword(ctx context.Context, id, password string, clubOnly bool) error {
	record, err := s.record(ctx, id, clubOnly)
	if err != nil {
		return err
	}
	if record.User.Role == "admin" {
		return domain.ErrProtected
	}
	hash, err := auth.PasswordHash(password)
	if err != nil {
		return err
	}
	return s.repo.ResetPassword(ctx, id, hash)
}
func (s *Service) Bootstrap(ctx context.Context, in auth.AccountInput) (Account, error) {
	in.Role = "admin"
	u, err := auth.PrepareAccount(in)
	if err != nil {
		return Account{}, err
	}
	if err = s.repo.Bootstrap(ctx, u); err != nil {
		return Account{}, err
	}
	return dto(domain.Record{User: u}), nil
}
