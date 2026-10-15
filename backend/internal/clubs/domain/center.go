package domain

import "time"

// MatchView is a fixture from the club's point of view.
type MatchView struct {
	ID           string     `json:"id"`
	Round        int        `json:"round"`
	OpponentName string     `json:"opponentName"`
	IsHome       bool       `json:"isHome"`
	KickoffAt    *time.Time `json:"kickoffAt"`
	GoalsFor     *int       `json:"goalsFor"`
	GoalsAgainst *int       `json:"goalsAgainst"`
	Result       string     `json:"result"`
}

// LeagueView is the club's position in one league it takes part in.
type LeagueView struct {
	LeagueID       string      `json:"leagueId"`
	LeagueName     string      `json:"leagueName"`
	Season         string      `json:"season"`
	Status         string      `json:"status"`
	TeamCount      int         `json:"teamCount"`
	Position       int         `json:"position"`
	Points         int         `json:"points"`
	Played         int         `json:"played"`
	Wins           int         `json:"wins"`
	Draws          int         `json:"draws"`
	Losses         int         `json:"losses"`
	GoalDifference int         `json:"goalDifference"`
	Upcoming       []MatchView `json:"upcoming"`
	Recent         []MatchView `json:"recent"`
}

// Center is the club home summary: profile completeness, work waiting for the club, and league standings.
type Center struct {
	CompletenessPercent int          `json:"completenessPercent"`
	MissingFields       []string     `json:"missingFields"`
	PendingApplications int          `json:"pendingApplications"`
	PendingNews         int          `json:"pendingNews"`
	PublishedNews       int          `json:"publishedNews"`
	Leagues             []LeagueView `json:"leagues"`
}

type Counts struct {
	PendingApplications int
	PendingNews         int
	PublishedNews       int
}
