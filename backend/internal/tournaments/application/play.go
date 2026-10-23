package application

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/tournaments/domain"
)

// Table is the public fixture and standings of a tournament.
func (s *Service) Table(ctx context.Context, id string) (domain.Table, error) {
	if !validID.MatchString(id) {
		return domain.Table{}, domain.ErrNotFound
	}
	return s.repo.Table(ctx, "", id)
}

// OrganizerTable is the same view for the organizer, cancelled tournaments included.
func (s *Service) OrganizerTable(ctx context.Context, organizerID, id string) (domain.Table, error) {
	if !validID.MatchString(id) {
		return domain.Table{}, domain.ErrNotFound
	}
	return s.repo.Table(ctx, organizerID, id)
}

func (s *Service) GenerateFixture(ctx context.Context, organizerID, id string, legs int) (domain.Table, error) {
	if !validID.MatchString(id) {
		return domain.Table{}, domain.ErrNotFound
	}
	if legs != 1 && legs != 2 {
		return domain.Table{}, auth.ValidationError{"legs": "Tek veya çift devre seç."}
	}
	return s.repo.GenerateFixture(ctx, organizerID, id, legs, newID)
}

func (s *Service) ClearFixture(ctx context.Context, organizerID, id string) (domain.Table, error) {
	if !validID.MatchString(id) {
		return domain.Table{}, domain.ErrNotFound
	}
	return s.repo.ClearFixture(ctx, organizerID, id)
}

// MatchInput is a fixture slot and, once played, its score. Both goals are
// set together or both left empty.
type MatchInput struct {
	Round       int        `json:"round"`
	HomeEntryID string     `json:"homeEntryId"`
	AwayEntryID string     `json:"awayEntryId"`
	KickoffAt   *time.Time `json:"kickoffAt"`
	Venue       string     `json:"venue"`
	HomeGoals   *int       `json:"homeGoals"`
	AwayGoals   *int       `json:"awayGoals"`
}

func (s *Service) SaveMatch(ctx context.Context, organizerID, tournamentID, matchID string, in MatchInput) (domain.Match, error) {
	create := matchID == ""
	if !validID.MatchString(tournamentID) || (!create && !validID.MatchString(matchID)) {
		return domain.Match{}, domain.ErrNotFound
	}
	in.Venue = strings.TrimSpace(in.Venue)
	fields := auth.ValidationError{}
	if in.Round < 1 || in.Round > 300 {
		fields["round"] = "Hafta 1-300 arasında olmalı."
	}
	if !validID.MatchString(in.HomeEntryID) || !validID.MatchString(in.AwayEntryID) {
		fields["teams"] = "İki takımı da seç."
	} else if in.HomeEntryID == in.AwayEntryID {
		fields["teams"] = "Bir takım kendisiyle eşleşemez."
	}
	if utf8.RuneCountInString(in.Venue) > 120 {
		fields["venue"] = "Saha en fazla 120 karakter olabilir."
	}
	if (in.HomeGoals == nil) != (in.AwayGoals == nil) {
		fields["score"] = "Skoru iki takım için de gir veya ikisini de boş bırak."
	} else if in.HomeGoals != nil && (*in.HomeGoals < 0 || *in.HomeGoals > 99 || *in.AwayGoals < 0 || *in.AwayGoals > 99) {
		fields["score"] = "Skor 0-99 arasında olmalı."
	}
	if len(fields) > 0 {
		return domain.Match{}, fields
	}
	if in.KickoffAt != nil {
		at := in.KickoffAt.UTC()
		in.KickoffAt = &at
	}
	if create {
		id, err := newID()
		if err != nil {
			return domain.Match{}, err
		}
		matchID = id
	}
	return s.repo.SaveMatch(ctx, organizerID, tournamentID, domain.Match{ID: matchID, Round: in.Round, HomeEntryID: in.HomeEntryID, AwayEntryID: in.AwayEntryID, KickoffAt: in.KickoffAt, Venue: in.Venue, HomeGoals: in.HomeGoals, AwayGoals: in.AwayGoals}, create)
}

func (s *Service) DeleteMatch(ctx context.Context, organizerID, tournamentID, matchID string) error {
	if !validID.MatchString(tournamentID) || !validID.MatchString(matchID) {
		return domain.ErrNotFound
	}
	return s.repo.DeleteMatch(ctx, organizerID, tournamentID, matchID)
}

func (s *Service) Candidates(ctx context.Context, organizerID, id, search string) ([]domain.Candidate, error) {
	if !validID.MatchString(id) {
		return nil, domain.ErrNotFound
	}
	search = strings.TrimSpace(search)
	if n := utf8.RuneCountInString(search); n < 2 || n > 80 {
		return nil, auth.ValidationError{"q": "Aramak için en az 2 harf yaz."}
	}
	return s.repo.Candidates(ctx, organizerID, id, search)
}

func (s *Service) Invite(ctx context.Context, organizerID, tournamentID, clubID, message string) (domain.Entry, error) {
	if !validID.MatchString(tournamentID) {
		return domain.Entry{}, domain.ErrNotFound
	}
	message = strings.TrimSpace(message)
	fields := auth.ValidationError{}
	if !validID.MatchString(clubID) {
		fields["clubId"] = "Davet edilecek takımı seç."
	}
	if utf8.RuneCountInString(message) > 300 {
		fields["message"] = "Mesaj en fazla 300 karakter olabilir."
	}
	if len(fields) > 0 {
		return domain.Entry{}, fields
	}
	id, err := newID()
	if err != nil {
		return domain.Entry{}, err
	}
	return s.repo.Invite(ctx, organizerID, tournamentID, id, clubID, message)
}

func (s *Service) CancelInvite(ctx context.Context, organizerID, tournamentID, entryID string) (domain.Entry, error) {
	if !validID.MatchString(tournamentID) || !validID.MatchString(entryID) {
		return domain.Entry{}, domain.ErrNotFound
	}
	return s.repo.CancelInvite(ctx, organizerID, tournamentID, entryID)
}

// RespondInvite accepts an invitation with a roster from the squad, or declines it.
func (s *Service) RespondInvite(ctx context.Context, clubID, entryID, decision string, playerIDs []string) (domain.Entry, error) {
	if !validID.MatchString(entryID) {
		return domain.Entry{}, domain.ErrNotFound
	}
	if decision != "accept" && decision != "decline" {
		return domain.Entry{}, auth.ValidationError{"decision": "Karar accept veya decline olmalı."}
	}
	roster, err := rosterOf(playerIDs)
	if err != nil {
		return domain.Entry{}, err
	}
	if decision == "decline" {
		roster = nil
	}
	return s.repo.RespondInvite(ctx, clubID, entryID, decision == "accept", roster)
}

func rosterOf(playerIDs []string) ([]string, error) {
	seen := map[string]bool{}
	roster := []string{}
	for _, id := range playerIDs {
		if !validID.MatchString(id) {
			return nil, auth.ValidationError{"playerIds": "Kadrodan geçerli oyuncular seç."}
		}
		if !seen[id] {
			seen[id] = true
			roster = append(roster, id)
		}
	}
	if len(roster) > domain.MaxRoster {
		return nil, auth.ValidationError{"playerIds": "Turnuva kadrosu en fazla 30 oyuncu olabilir."}
	}
	return roster, nil
}

func (s *Service) Organizers(ctx context.Context, page int) (domain.OrganizerPage, error) {
	if page < 1 || page > 100000 {
		return domain.OrganizerPage{}, auth.ValidationError{"page": "Sayfa numarası geçersiz."}
	}
	return s.repo.Organizers(ctx, page)
}

// OrganizerInput is what an administrator enters to open an organizer account.
type OrganizerInput struct {
	FullName string `json:"fullName"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Service) CreateOrganizer(ctx context.Context, in OrganizerInput) (domain.Organizer, error) {
	u, err := auth.PrepareAccount(auth.AccountInput{FullName: in.FullName, Username: in.Username, Email: in.Email, Password: in.Password, Role: "organizer"})
	if err != nil {
		return domain.Organizer{}, err
	}
	return s.repo.CreateOrganizer(ctx, u)
}

// PlayerTournaments lists the tournaments a player plays in through a team roster.
func (s *Service) PlayerTournaments(ctx context.Context, playerID string) ([]domain.PlayerTournament, error) {
	reader, ok := s.repo.(domain.PlayerTournaments)
	if !ok {
		return []domain.PlayerTournament{}, nil
	}
	return reader.PlayerTournaments(ctx, playerID)
}

// ClubTournaments lists the club's accepted entries with position and next match.
func (s *Service) ClubTournaments(ctx context.Context, clubID string) ([]domain.PlayerTournament, error) {
	reader, ok := s.repo.(domain.PlayerTournaments)
	if !ok {
		return []domain.PlayerTournament{}, nil
	}
	return reader.ClubTournaments(ctx, clubID)
}
