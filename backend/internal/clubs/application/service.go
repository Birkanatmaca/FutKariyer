package application

import (
	"context"
	"strings"
	"time"

	admin "futcareer/backend/internal/admin/application"
	"futcareer/backend/internal/clubs/domain"
	leaguedomain "futcareer/backend/internal/leagues/domain"
)

type Repository interface {
	Squad(context.Context, string) ([]domain.SquadMember, error)
	RemoveMember(context.Context, string, string) error
	Memberships(context.Context, string) ([]domain.Membership, error)
	AdminOverviewAccount(context.Context, string) (email string, active bool, err error)
	News(context.Context, string) ([]domain.NewsItem, error)
	Applications(context.Context, string) ([]domain.ApplicationItem, error)
	Profile(context.Context, string) (domain.Profile, error)
	UpdateProfile(context.Context, string, domain.Profile) (domain.Profile, error)
	Counts(context.Context, string) (domain.Counts, error)
	LeagueIDs(context.Context, string) ([]string, error)
}

// LeagueDetails is the public league read the club center uses for standings and fixtures.
type LeagueDetails interface {
	Get(context.Context, string, bool) (leaguedomain.Detail, error)
}

type Service struct {
	repo    Repository
	leagues LeagueDetails
}

func New(repo Repository, leagues LeagueDetails) *Service {
	return &Service{repo: repo, leagues: leagues}
}

// ProfileInput is what a club may edit. Football type and account name stay admin-managed.
type ProfileInput struct {
	District              string `json:"district"`
	Description           string `json:"description"`
	VenueName             string `json:"venueName"`
	VenueAddress          string `json:"venueAddress"`
	TrainingGroundName    string `json:"trainingGroundName"`
	TrainingGroundAddress string `json:"trainingGroundAddress"`
	TrainingSchedule      string `json:"trainingSchedule"`
}

func (s *Service) Profile(ctx context.Context, userID string) (domain.Profile, error) {
	return s.repo.Profile(ctx, userID)
}

func (s *Service) UpdateProfile(ctx context.Context, userID string, in ProfileInput) (domain.Profile, error) {
	in.District = strings.TrimSpace(in.District)
	in.Description = strings.TrimSpace(in.Description)
	in.VenueName = strings.TrimSpace(in.VenueName)
	in.VenueAddress = strings.TrimSpace(in.VenueAddress)
	in.TrainingGroundName = strings.TrimSpace(in.TrainingGroundName)
	in.TrainingGroundAddress = strings.TrimSpace(in.TrainingGroundAddress)
	in.TrainingSchedule = strings.TrimSpace(in.TrainingSchedule)
	if fields := admin.ClubFieldErrors(in.District, in.Description, in.VenueName, in.VenueAddress, in.TrainingGroundName, in.TrainingGroundAddress, in.TrainingSchedule); len(fields) > 0 {
		return domain.Profile{}, fields
	}
	current, err := s.repo.Profile(ctx, userID)
	if err != nil {
		return domain.Profile{}, err
	}
	next := current
	next.District, next.Description = in.District, in.Description
	next.VenueName, next.VenueAddress = in.VenueName, in.VenueAddress
	next.TrainingGroundName, next.TrainingGroundAddress = in.TrainingGroundName, in.TrainingGroundAddress
	next.TrainingSchedule = in.TrainingSchedule
	next.UpdatedAt = time.Now().UTC()
	return s.repo.UpdateProfile(ctx, userID, next)
}

var profileFields = []struct {
	label string
	value func(domain.Profile) string
}{
	{"İlçe", func(p domain.Profile) string { return p.District }},
	{"Tanıtım", func(p domain.Profile) string { return p.Description }},
	{"Maç sahası", func(p domain.Profile) string { return p.VenueName }},
	{"Maç sahası adresi", func(p domain.Profile) string { return p.VenueAddress }},
	{"Antrenman sahası", func(p domain.Profile) string { return p.TrainingGroundName }},
	{"Antrenman adresi", func(p domain.Profile) string { return p.TrainingGroundAddress }},
	{"Antrenman programı", func(p domain.Profile) string { return p.TrainingSchedule }},
}

// Center assembles the club home summary. Leagues come from the public league
// detail, so the club sees exactly what players see.
func (s *Service) Center(ctx context.Context, userID string) (domain.Center, error) {
	out := domain.Center{MissingFields: []string{}, Leagues: []domain.LeagueView{}}
	profile, err := s.repo.Profile(ctx, userID)
	if err != nil {
		return out, err
	}
	filled := 0
	for _, field := range profileFields {
		if field.value(profile) == "" {
			out.MissingFields = append(out.MissingFields, field.label)
		} else {
			filled++
		}
	}
	out.CompletenessPercent = filled * 100 / len(profileFields)
	counts, err := s.repo.Counts(ctx, userID)
	if err != nil {
		return out, err
	}
	out.PendingApplications, out.PendingNews, out.PublishedNews = counts.PendingApplications, counts.PendingNews, counts.PublishedNews
	ids, err := s.repo.LeagueIDs(ctx, userID)
	if err != nil {
		return out, err
	}
	for _, id := range ids {
		detail, err := s.leagues.Get(ctx, id, false)
		if err != nil {
			continue
		}
		if view, ok := leagueView(detail, userID); ok {
			out.Leagues = append(out.Leagues, view)
		}
	}
	return out, nil
}

func leagueView(detail leaguedomain.Detail, clubID string) (domain.LeagueView, bool) {
	teamID := ""
	for _, team := range detail.Teams {
		if team.ClubID == clubID {
			teamID = team.ID
		}
	}
	if teamID == "" {
		return domain.LeagueView{}, false
	}
	view := domain.LeagueView{LeagueID: detail.League.ID, LeagueName: detail.League.Name, Season: detail.League.Season, Status: detail.League.Status, TeamCount: len(detail.Teams), Upcoming: []domain.MatchView{}, Recent: []domain.MatchView{}}
	for _, row := range detail.Standings {
		if row.TeamID == teamID {
			view.Position, view.Points, view.Played = row.Position, row.Points, row.Played
			view.Wins, view.Draws, view.Losses, view.GoalDifference = row.Wins, row.Draws, row.Losses, row.GoalDiff
		}
	}
	for _, m := range detail.Matches {
		if m.HomeTeamID != teamID && m.AwayTeamID != teamID {
			continue
		}
		isHome := m.HomeTeamID == teamID
		opponent := m.AwayName
		goalsFor, goalsAgainst := m.HomeGoals, m.AwayGoals
		if !isHome {
			opponent = m.HomeName
			goalsFor, goalsAgainst = m.AwayGoals, m.HomeGoals
		}
		item := domain.MatchView{ID: m.ID, Round: m.Round, OpponentName: opponent, IsHome: isHome, KickoffAt: m.KickoffAt}
		if goalsFor == nil || goalsAgainst == nil {
			view.Upcoming = append(view.Upcoming, item)
			continue
		}
		item.GoalsFor, item.GoalsAgainst = goalsFor, goalsAgainst
		switch {
		case *goalsFor > *goalsAgainst:
			item.Result = "win"
		case *goalsFor == *goalsAgainst:
			item.Result = "draw"
		default:
			item.Result = "loss"
		}
		view.Recent = append(view.Recent, item)
	}
	if len(view.Upcoming) > 3 {
		view.Upcoming = view.Upcoming[:3]
	}
	if len(view.Recent) > 3 {
		view.Recent = view.Recent[len(view.Recent)-3:]
	}
	return view, true
}

// Overview gathers everything an administrator needs about one club on a single screen.
func (s *Service) Overview(ctx context.Context, clubID string) (domain.Overview, error) {
	out := domain.Overview{News: []domain.NewsItem{}, Applications: []domain.ApplicationItem{}, Leagues: []domain.LeagueView{}}
	email, active, err := s.repo.AdminOverviewAccount(ctx, clubID)
	if err != nil {
		return out, err
	}
	out.Email, out.Active = email, active
	if out.Profile, err = s.repo.Profile(ctx, clubID); err != nil {
		return out, err
	}
	if out.News, err = s.repo.News(ctx, clubID); err != nil {
		return out, err
	}
	if out.Applications, err = s.repo.Applications(ctx, clubID); err != nil {
		return out, err
	}
	ids, err := s.repo.LeagueIDs(ctx, clubID)
	if err != nil {
		return out, err
	}
	for _, id := range ids {
		detail, err := s.leagues.Get(ctx, id, false)
		if err != nil {
			continue
		}
		if view, ok := leagueView(detail, clubID); ok {
			out.Leagues = append(out.Leagues, view)
		}
	}
	return out, nil
}

func (s *Service) Squad(ctx context.Context, clubID string) ([]domain.SquadMember, error) {
	return s.repo.Squad(ctx, clubID)
}

// RemoveMember ends a squad membership; the club removes a player or a player leaves a club.
func (s *Service) RemoveMember(ctx context.Context, clubID, playerID string) error {
	return s.repo.RemoveMember(ctx, clubID, playerID)
}

func (s *Service) Memberships(ctx context.Context, playerID string) ([]domain.Membership, error) {
	return s.repo.Memberships(ctx, playerID)
}
