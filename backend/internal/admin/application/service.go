package application

import (
	"context"
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
	District string `json:"district"`
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
	District string `json:"district"`
}
type UpdateInput struct {
	FullName string `json:"fullName"`
	Email    string `json:"email"`
	Username string `json:"username"`
	District string `json:"district"`
	Active   *bool  `json:"active"`
}

func dto(record domain.Record) Account {
	result := Account{PublicUser: auth.Public(record.User)}
	if record.Club != nil {
		result.District = record.Club.District
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
	} else if in.Role != "player" && in.Role != "coach" {
		return Account{}, auth.ValidationError{"role": "Bu bölümde sporcu veya antrenör oluşturabilirsin. Kulüp için kulüpler bölümünü kullan."}
	}
	in.District = strings.TrimSpace(in.District)
	if utf8.RuneCountInString(in.District) > 80 {
		return Account{}, auth.ValidationError{"district": "İlçe en fazla 80 karakter olmalı."}
	}
	u, err := auth.PrepareAccount(in.AccountInput)
	if err != nil {
		return Account{}, err
	}
	record := domain.Record{User: u}
	if clubOnly {
		record.Club = &clubs.Club{UserID: u.ID, District: in.District, UpdatedAt: time.Now().UTC()}
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
	if in.Active == nil {
		fields["active"] = "Hesap erişim durumunu seç."
	}
	if utf8.RuneCountInString(in.District) > 80 {
		fields["district"] = "İlçe en fazla 80 karakter olmalı."
	}
	if len(fields) > 0 {
		return Account{}, fields
	}
	record.User.FullName = normalized.FullName
	record.User.Email = normalized.Email
	record.User.Username = normalized.Username
	record.User.Active = *in.Active
	if record.Club != nil {
		record.Club.District = in.District
		record.Club.UpdatedAt = time.Now().UTC()
	}
	if err = s.repo.Update(ctx, record); err != nil {
		return Account{}, err
	}
	return dto(record), nil
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
