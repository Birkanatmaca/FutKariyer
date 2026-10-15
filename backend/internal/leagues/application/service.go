package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"strings"
	"unicode/utf8"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/leagues/domain"
)

type Service struct{ repo domain.Repository }

func New(repo domain.Repository) *Service { return &Service{repo: repo} }

func newID() (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(value[:]), nil
}

func (s *Service) List(ctx context.Context, admin bool, page int) (domain.Page[domain.League], error) {
	if page < 1 || page > 1000000 {
		return domain.Page[domain.League]{}, auth.ValidationError{"page": "Sayfa numarası 1 ile 1000000 arasında olmalı."}
	}
	return s.repo.List(ctx, admin, page)
}

func (s *Service) Get(ctx context.Context, id string, admin bool) (domain.Detail, error) {
	return s.repo.Get(ctx, id, admin)
}

func (s *Service) Save(ctx context.Context, value domain.League, create bool) (domain.League, error) {
	value.Name = strings.TrimSpace(value.Name)
	value.Season = strings.TrimSpace(value.Season)
	value.Description = strings.TrimSpace(value.Description)
	fields := auth.ValidationError{}
	if n := utf8.RuneCountInString(value.Name); n < 2 || n > 120 {
		fields["name"] = "Lig adı 2–120 karakter olmalı."
	}
	if n := utf8.RuneCountInString(value.Season); n < 1 || n > 40 {
		fields["season"] = "Sezon bilgisi 1–40 karakter olmalı."
	}
	if utf8.RuneCountInString(value.Description) > 1000 {
		fields["description"] = "Açıklama en fazla 1000 karakter olmalı."
	}
	if value.Status != "draft" && value.Status != "active" && value.Status != "finished" {
		fields["status"] = "Lig durumu taslak, yayında veya tamamlandı olmalı."
	}
	if value.WinPoints < 0 || value.WinPoints > 10 {
		fields["winPoints"] = "Galibiyet puanı 0–10 arasında olmalı."
	}
	if value.DrawPoints < 0 || value.DrawPoints > 10 {
		fields["drawPoints"] = "Beraberlik puanı 0–10 arasında olmalı."
	}
	if value.LossPoints < 0 || value.LossPoints > 10 {
		fields["lossPoints"] = "Mağlubiyet puanı 0–10 arasında olmalı."
	}
	if len(fields) > 0 {
		return domain.League{}, fields
	}
	if create {
		id, err := newID()
		if err != nil {
			return domain.League{}, err
		}
		value.ID = id
	}
	return s.repo.Save(ctx, value, create)
}

func (s *Service) Delete(ctx context.Context, id string) error { return s.repo.Delete(ctx, id) }

func (s *Service) Clubs(ctx context.Context, search string, page int) (domain.Page[domain.ClubOption], error) {
	search = strings.TrimSpace(search)
	if page < 1 || page > 1000000 || utf8.RuneCountInString(search) > 80 {
		return domain.Page[domain.ClubOption]{}, auth.ValidationError{"search": "Arama en fazla 80 karakter, sayfa 1 ile 1000000 olmalı."}
	}
	return s.repo.Clubs(ctx, search, page)
}

func (s *Service) AddTeam(ctx context.Context, leagueID, clubID string) (domain.Team, error) {
	id, err := newID()
	if err != nil {
		return domain.Team{}, err
	}
	return s.repo.AddTeam(ctx, leagueID, clubID, id)
}

func (s *Service) RemoveTeam(ctx context.Context, leagueID, teamID string) error {
	return s.repo.RemoveTeam(ctx, leagueID, teamID)
}

func (s *Service) SaveMatch(ctx context.Context, leagueID string, value domain.Match, create bool) (domain.Match, error) {
	fields := auth.ValidationError{}
	if value.Round < 1 || value.Round > 100 {
		fields["round"] = "Hafta 1–100 arasında olmalı."
	}
	if value.HomeTeamID == "" || value.AwayTeamID == "" || value.HomeTeamID == value.AwayTeamID {
		fields["teams"] = "Farklı iki lig takımı seç."
	}
	if (value.HomeGoals == nil) != (value.AwayGoals == nil) {
		fields["score"] = "Maç sonucu için iki takımın skorunu da gir."
	}
	if value.HomeGoals != nil && value.AwayGoals != nil && (*value.HomeGoals < 0 || *value.HomeGoals > 50 || *value.AwayGoals < 0 || *value.AwayGoals > 50) {
		fields["score"] = "Skorlar 0–50 arasında olmalı."
	}
	if len(fields) > 0 {
		return domain.Match{}, fields
	}
	if create {
		id, err := newID()
		if err != nil {
			return domain.Match{}, err
		}
		value.ID = id
	}
	return s.repo.SaveMatch(ctx, leagueID, value, create)
}

func (s *Service) DeleteMatch(ctx context.Context, leagueID, matchID string) error {
	return s.repo.DeleteMatch(ctx, leagueID, matchID)
}
