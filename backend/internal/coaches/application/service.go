package application

import (
	"context"
	"strings"
	"unicode/utf8"

	"futcareer/backend/internal/coaches/domain"
)

type Service struct{ repo domain.Repository }

func New(repo domain.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Profile(ctx context.Context, coachID string) (domain.Profile, error) {
	return s.repo.Profile(ctx, coachID)
}

func (s *Service) SaveProfile(ctx context.Context, coachID string, p domain.Profile) (domain.Profile, error) {
	p, err := domain.Normalize(p)
	if err != nil {
		return p, err
	}
	return s.repo.SaveProfile(ctx, coachID, p)
}

func (s *Service) Staff(ctx context.Context, clubID string) ([]domain.Member, error) {
	return s.repo.Staff(ctx, clubID)
}

// Candidates searches active coaches by name (at least two letters) who are
// not yet on or invited to the club's staff.
func (s *Service) Candidates(ctx context.Context, clubID, query string) ([]domain.Candidate, error) {
	query = strings.Join(strings.Fields(query), " ")
	if utf8.RuneCountInString(query) < 2 {
		return []domain.Candidate{}, nil
	}
	if utf8.RuneCountInString(query) > 60 {
		query = string([]rune(query)[:60])
	}
	return s.repo.Candidates(ctx, clubID, query)
}

func (s *Service) Invite(ctx context.Context, clubID, coachID, role string, permissions []string) error {
	role, permissions, err := domain.NormalizeGrant(role, permissions)
	if err != nil {
		return err
	}
	return s.repo.Invite(ctx, clubID, coachID, role, permissions)
}

func (s *Service) Update(ctx context.Context, clubID, coachID, role string, permissions []string) error {
	role, permissions, err := domain.NormalizeGrant(role, permissions)
	if err != nil {
		return err
	}
	return s.repo.UpdateMember(ctx, clubID, coachID, role, permissions)
}

func (s *Service) Remove(ctx context.Context, clubID, coachID string) error {
	return s.repo.RemoveMember(ctx, clubID, coachID)
}

func (s *Service) Memberships(ctx context.Context, coachID string) ([]domain.Membership, error) {
	return s.repo.Memberships(ctx, coachID)
}

func (s *Service) Respond(ctx context.Context, coachID, clubID string, accept bool) error {
	return s.repo.Respond(ctx, coachID, clubID, accept)
}

func (s *Service) Leave(ctx context.Context, coachID, clubID string) error {
	return s.repo.Leave(ctx, coachID, clubID)
}

func (s *Service) PublicStaff(ctx context.Context, clubID string) ([]domain.StaffCard, error) {
	return s.repo.PublicStaff(ctx, clubID)
}

// CoachCard is a coach's football profile as one viewer may see it.
type CoachCard struct {
	Profile any               `json:"profile"`
	Clubs   []domain.ClubCard `json:"clubs"`
	Full    bool              `json:"full"`
}

// PublicCoach shows clubs and the coach themself everything; everyone else
// sees only the groups the coach turned on.
func (s *Service) PublicCoach(ctx context.Context, coachID, viewerID, viewerRole string) (CoachCard, error) {
	profile, err := s.repo.Profile(ctx, coachID)
	if err != nil {
		return CoachCard{}, err
	}
	full := viewerRole == "club" || viewerID == coachID
	card := CoachCard{Clubs: []domain.ClubCard{}, Full: full}
	if full {
		card.Profile = profile
	} else {
		card.Profile = profile.Public()
	}
	if full || profile.Visibility.Clubs {
		if card.Clubs, err = s.repo.ActiveClubs(ctx, coachID); err != nil {
			return CoachCard{}, err
		}
	}
	return card, nil
}
