package application

import (
	"context"
	"slices"

	"futcareer/backend/internal/clubs/domain"
	leaguedomain "futcareer/backend/internal/leagues/domain"
)

// Leagues is the club's Maçlarım page (20 Oct 2026): every league it plays
// in with the whole table, every club match and every week of the group.
func (s *Service) Leagues(ctx context.Context, userID string) (domain.Leagues, error) {
	profile, err := s.repo.Profile(ctx, userID)
	if err != nil {
		return domain.Leagues{}, err
	}
	linked, leagues, err := s.clubLeagues(ctx, userID, profile)
	return domain.Leagues{TFFLinked: linked, Leagues: leagues}, err
}

// clubLeagues reads the club's TFF group first, then its Fut Career leagues
// from the public league detail, so the club sees exactly what players see.
func (s *Service) clubLeagues(ctx context.Context, userID string, profile domain.Profile) (bool, []domain.LeagueDetail, error) {
	out := []domain.LeagueDetail{}
	if profile.TFF != nil {
		if detail, ok := s.tffLeague(ctx, *profile.TFF); ok {
			out = append(out, detail)
		}
	}
	ids, err := s.repo.LeagueIDs(ctx, userID)
	if err != nil {
		return profile.TFF != nil, out, err
	}
	for _, id := range ids {
		league, err := s.leagues.Get(ctx, id, false)
		if err != nil {
			continue
		}
		if detail, ok := leagueDetail(league, userID); ok {
			out = append(out, detail)
		}
	}
	return profile.TFF != nil, out, s.withCrests(ctx, out)
}

// withCrests adds the rival clubs' photo versions so the app can show their crests.
func (s *Service) withCrests(ctx context.Context, leagues []domain.LeagueDetail) error {
	lists := [][]domain.MatchView{}
	ids := []string{}
	for _, l := range leagues {
		lists = append(lists, l.Upcoming, l.Recent, l.Matches)
		for _, m := range l.Matches {
			if m.OpponentID != "" && !slices.Contains(ids, m.OpponentID) {
				ids = append(ids, m.OpponentID)
			}
		}
	}
	if len(ids) == 0 {
		return nil
	}
	versions, err := s.repo.AvatarVersions(ctx, ids)
	if err != nil {
		return err
	}
	for _, list := range lists {
		for i := range list {
			list[i].OpponentAvatarVersion = versions[list[i].OpponentID]
		}
	}
	return nil
}

// leagueView is a Fut Career league's summary for the home card and the
// administrator overview.
func leagueView(detail leaguedomain.Detail, clubID string) (domain.LeagueView, bool) {
	out, ok := leagueDetail(detail, clubID)
	return out.LeagueView, ok
}

func leagueDetail(detail leaguedomain.Detail, clubID string) (domain.LeagueDetail, bool) {
	teamID := ""
	clubOf := map[string]string{}
	for _, team := range detail.Teams {
		clubOf[team.ID] = team.ClubID
		if team.ClubID == clubID {
			teamID = team.ID
		}
	}
	if teamID == "" {
		return domain.LeagueDetail{}, false
	}
	view := domain.LeagueView{LeagueID: detail.League.ID, Source: "futcareer", LeagueName: detail.League.Name, Season: detail.League.Season, Status: detail.League.Status, TeamCount: len(detail.Teams), Standings: []domain.StandingView{}}
	for _, row := range detail.Standings {
		own := row.TeamID == teamID
		view.Standings = append(view.Standings, domain.StandingView{Position: row.Position, TeamName: row.TeamName, Played: row.Played, Wins: row.Wins, Draws: row.Draws, Losses: row.Losses, GoalDifference: row.GoalDiff, Points: row.Points, Own: own})
		if own {
			view.Position, view.Points, view.Played = row.Position, row.Points, row.Played
			view.Wins, view.Draws, view.Losses, view.GoalDifference = row.Wins, row.Draws, row.Losses, row.GoalDiff
		}
	}
	out := domain.LeagueDetail{LeagueView: view, Matches: []domain.MatchView{}, Weeks: []domain.WeekView{}}
	// Matches come ordered by round, so each round is one contiguous run.
	for _, m := range detail.Matches {
		own := m.HomeTeamID == teamID || m.AwayTeamID == teamID
		if n := len(out.Weeks); n == 0 || out.Weeks[n-1].Number != m.Round {
			out.Weeks = append(out.Weeks, domain.WeekView{Number: m.Round, Matches: []domain.FixtureView{}})
		}
		week := &out.Weeks[len(out.Weeks)-1]
		week.Matches = append(week.Matches, domain.FixtureView{ID: m.ID, HomeName: m.HomeName, AwayName: m.AwayName, HomeGoals: m.HomeGoals, AwayGoals: m.AwayGoals, KickoffAt: m.KickoffAt, Own: own})
		if !own {
			continue
		}
		isHome := m.HomeTeamID == teamID
		opponent, opponentTeam := m.AwayName, m.AwayTeamID
		goalsFor, goalsAgainst := m.HomeGoals, m.AwayGoals
		if !isHome {
			opponent, opponentTeam = m.HomeName, m.HomeTeamID
			goalsFor, goalsAgainst = m.AwayGoals, m.HomeGoals
		}
		item := domain.MatchView{ID: m.ID, Round: m.Round, OpponentName: opponent, OpponentID: clubOf[opponentTeam], IsHome: isHome, KickoffAt: m.KickoffAt}
		if goalsFor != nil && goalsAgainst != nil {
			item = scored(item, goalsFor, goalsAgainst)
		}
		out.Matches = append(out.Matches, item)
	}
	return summarize(out), true
}

// CoachTeams is the coach's Takımım page: every club they work for with its
// main league (the TFF group first), the squad size and, for coaches with the
// applications right, the waiting applications.
func (s *Service) CoachTeams(ctx context.Context, coachID string) (domain.CoachTeams, error) {
	links, invitations, err := s.repo.CoachLinks(ctx, coachID)
	if err != nil {
		return domain.CoachTeams{}, err
	}
	out := domain.CoachTeams{Teams: []domain.CoachTeam{}, Invitations: invitations}
	for _, link := range links {
		profile, err := s.repo.Profile(ctx, link.ClubID)
		if err != nil {
			return out, err
		}
		counts, err := s.repo.Counts(ctx, link.ClubID)
		if err != nil {
			return out, err
		}
		team := domain.CoachTeam{ClubID: link.ClubID, ClubName: link.ClubName, AvatarVersion: link.AvatarVersion, District: link.District, Role: link.Role, Permissions: link.Permissions, SquadCount: counts.SquadCount}
		if slices.Contains(link.Permissions, "applications") {
			team.PendingApplications = counts.PendingApplications
		}
		linked, leagues, err := s.clubLeagues(ctx, link.ClubID, profile)
		if err != nil {
			return out, err
		}
		team.TFFLinked = linked
		if len(leagues) > 0 {
			team.League = &leagues[0].LeagueView
		}
		out.Teams = append(out.Teams, team)
	}
	return out, nil
}
