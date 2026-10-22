package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/tournaments/domain"
)

var validID = regexp.MustCompile(`^[a-f0-9]{32}$`)

type Service struct {
	repo domain.Repository
	now  func() time.Time
}

func New(repo domain.Repository) *Service { return &Service{repo: repo, now: time.Now} }

func newID() (string, error) {
	var v [16]byte
	if _, err := rand.Read(v[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(v[:]), nil
}

type Input struct {
	Name                string   `json:"name"`
	Format              string   `json:"format"`
	EligibleTypes       []string `json:"eligibleTypes"`
	District            string   `json:"district"`
	Venue               string   `json:"venue"`
	Description         string   `json:"description"`
	StartsOn            string   `json:"startsOn"`
	EndsOn              string   `json:"endsOn"`
	ApplicationDeadline string   `json:"applicationDeadline"`
	TeamCapacity        int      `json:"teamCapacity"`
}

// today is the calendar day in Türkiye, which is what tournament dates refer to.
func (s *Service) today() string {
	loc := time.FixedZone("TRT", 3*60*60)
	return s.now().In(loc).Format(time.DateOnly)
}

func validDate(v string) bool {
	_, err := time.Parse(time.DateOnly, v)
	return err == nil
}

// Create validates and publishes a tournament for a verified organizer.
func (s *Service) Create(ctx context.Context, organizerID string, in Input) (domain.Tournament, int, error) {
	in.Name, in.District, in.Venue, in.Description = strings.TrimSpace(in.Name), strings.TrimSpace(in.District), strings.TrimSpace(in.Venue), strings.TrimSpace(in.Description)
	fields := auth.ValidationError{}
	if n := utf8.RuneCountInString(in.Name); n < 2 || n > 120 {
		fields["name"] = "Turnuva adı 2-120 karakter olmalı."
	}
	if !domain.Formats[in.Format] {
		fields["format"] = "Turnuva türünü seç."
	}
	seen := map[string]bool{}
	types := []string{}
	for _, t := range in.EligibleTypes {
		if !domain.TeamTypes[t] {
			fields["eligibleTypes"] = "Geçerli takım türleri seç."
		} else if !seen[t] {
			seen[t] = true
			types = append(types, t)
		}
	}
	if len(types) == 0 && fields["eligibleTypes"] == "" {
		fields["eligibleTypes"] = "Başvurabilecek en az bir takım türü seç."
	}
	if utf8.RuneCountInString(in.District) > 80 {
		fields["district"] = "İlçe en fazla 80 karakter olabilir."
	}
	if utf8.RuneCountInString(in.Venue) > 120 {
		fields["venue"] = "Saha en fazla 120 karakter olabilir."
	}
	if utf8.RuneCountInString(in.Description) > 2000 {
		fields["description"] = "Açıklama en fazla 2000 karakter olabilir."
	}
	today := s.today()
	switch {
	case !validDate(in.StartsOn):
		fields["startsOn"] = "Başlangıç tarihini YYYY-AA-GG biçiminde gir."
	case in.StartsOn < today:
		fields["startsOn"] = "Başlangıç tarihi geçmişte olamaz."
	}
	if !validDate(in.EndsOn) || (validDate(in.StartsOn) && in.EndsOn < in.StartsOn) {
		fields["endsOn"] = "Bitiş tarihi başlangıçtan önce olamaz."
	}
	if !validDate(in.ApplicationDeadline) || in.ApplicationDeadline < today || (validDate(in.StartsOn) && in.ApplicationDeadline > in.StartsOn) {
		fields["applicationDeadline"] = "Son başvuru tarihi bugün ile başlangıç arasında olmalı."
	}
	if in.TeamCapacity < 2 || in.TeamCapacity > 128 {
		fields["teamCapacity"] = "Takım kapasitesi 2-128 arasında olmalı."
	}
	if len(fields) > 0 {
		return domain.Tournament{}, 0, fields
	}
	id, err := newID()
	if err != nil {
		return domain.Tournament{}, 0, err
	}
	return s.repo.Create(ctx, domain.Tournament{ID: id, OrganizerID: organizerID, Name: in.Name, Format: in.Format, EligibleTypes: types, District: in.District, Venue: in.Venue, Description: in.Description, StartsOn: in.StartsOn, EndsOn: in.EndsOn, ApplicationDeadline: in.ApplicationDeadline, TeamCapacity: in.TeamCapacity})
}

func (s *Service) Mine(ctx context.Context, organizerID string) ([]domain.Tournament, error) {
	return s.repo.Mine(ctx, organizerID)
}

func (s *Service) SetStatus(ctx context.Context, organizerID, id, status string) (domain.Tournament, error) {
	if !validID.MatchString(id) {
		return domain.Tournament{}, domain.ErrNotFound
	}
	if status != "open" && status != "closed" && status != "finished" && status != "cancelled" {
		return domain.Tournament{}, auth.ValidationError{"status": "Geçerli bir durum seç."}
	}
	return s.repo.SetStatus(ctx, organizerID, id, status)
}

func (s *Service) Entries(ctx context.Context, organizerID, id string) ([]domain.Entry, error) {
	if !validID.MatchString(id) {
		return nil, domain.ErrNotFound
	}
	return s.repo.Entries(ctx, organizerID, id)
}

func (s *Service) Decide(ctx context.Context, organizerID, tournamentID, entryID, decision string) (domain.Entry, error) {
	if !validID.MatchString(tournamentID) || !validID.MatchString(entryID) {
		return domain.Entry{}, domain.ErrNotFound
	}
	if decision != "accept" && decision != "reject" {
		return domain.Entry{}, auth.ValidationError{"decision": "Karar accept veya reject olmalı."}
	}
	return s.repo.Decide(ctx, organizerID, tournamentID, entryID, decision == "accept")
}

// List pages public tournaments; format narrows to one type and all adds
// running and finished tournaments to those taking entries.
func (s *Service) List(ctx context.Context, format string, all bool, page int) (domain.Page, error) {
	if page < 1 || page > 100000 {
		return domain.Page{}, auth.ValidationError{"page": "Sayfa numarası geçersiz."}
	}
	if format != "" && !domain.Formats[format] {
		return domain.Page{}, auth.ValidationError{"format": "Geçerli bir turnuva türü seç."}
	}
	return s.repo.List(ctx, domain.Filter{Format: format, All: all}, page)
}

func (s *Service) Get(ctx context.Context, id string) (domain.Tournament, error) {
	if !validID.MatchString(id) {
		return domain.Tournament{}, domain.ErrNotFound
	}
	return s.repo.Get(ctx, id)
}

// Enter registers a club's team with a roster picked from its squad.
func (s *Service) Enter(ctx context.Context, clubID, tournamentID, message string, playerIDs []string) (domain.Entry, error) {
	if !validID.MatchString(tournamentID) {
		return domain.Entry{}, domain.ErrNotFound
	}
	message = strings.TrimSpace(message)
	fields := auth.ValidationError{}
	if utf8.RuneCountInString(message) > 300 {
		fields["message"] = "Mesaj en fazla 300 karakter olabilir."
	}
	seen := map[string]bool{}
	roster := []string{}
	for _, id := range playerIDs {
		if !validID.MatchString(id) {
			fields["playerIds"] = "Kadrodan geçerli oyuncular seç."
			break
		}
		if !seen[id] {
			seen[id] = true
			roster = append(roster, id)
		}
	}
	if len(roster) > domain.MaxRoster {
		fields["playerIds"] = "Turnuva kadrosu en fazla 30 oyuncu olabilir."
	}
	if len(fields) > 0 {
		return domain.Entry{}, fields
	}
	id, err := newID()
	if err != nil {
		return domain.Entry{}, err
	}
	return s.repo.Enter(ctx, clubID, tournamentID, id, message, roster)
}

func (s *Service) ClubEntries(ctx context.Context, clubID string) ([]domain.Entry, error) {
	return s.repo.ClubEntries(ctx, clubID)
}

func (s *Service) Withdraw(ctx context.Context, clubID, entryID string) (domain.Entry, error) {
	if !validID.MatchString(entryID) {
		return domain.Entry{}, domain.ErrNotFound
	}
	return s.repo.Withdraw(ctx, clubID, entryID)
}
