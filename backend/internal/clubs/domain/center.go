package domain

import "time"

// MatchView is a fixture from the club's point of view.
type MatchView struct {
	ID           string `json:"id"`
	Round        int    `json:"round"`
	OpponentName string `json:"opponentName"`
	// OpponentID and OpponentAvatarVersion show the rival club's crest in
	// Fut Career leagues; TFF teams have neither.
	OpponentID            string     `json:"opponentId"`
	OpponentAvatarVersion int        `json:"opponentAvatarVersion"`
	IsHome                bool       `json:"isHome"`
	KickoffAt             *time.Time `json:"kickoffAt"`
	// DateOnly marks a kickoff whose day is known but whose time is not yet set.
	DateOnly     bool   `json:"dateOnly"`
	Venue        string `json:"venue"`
	GoalsFor     *int   `json:"goalsFor"`
	GoalsAgainst *int   `json:"goalsAgainst"`
	Result       string `json:"result"`
}

// StandingView is one row of a league table; Own marks the club's row.
type StandingView struct {
	Position       int    `json:"position"`
	TeamName       string `json:"teamName"`
	Played         int    `json:"played"`
	Wins           int    `json:"wins"`
	Draws          int    `json:"draws"`
	Losses         int    `json:"losses"`
	GoalDifference int    `json:"goalDifference"`
	Points         int    `json:"points"`
	Own            bool   `json:"own"`
}

// LeagueView is the club's position in one league it takes part in. Source is
// "tff" for the club's TFF Ankara group and "futcareer" for leagues run here.
type LeagueView struct {
	LeagueID       string         `json:"leagueId"`
	Source         string         `json:"source"`
	LeagueName     string         `json:"leagueName"`
	Season         string         `json:"season"`
	Status         string         `json:"status"`
	TeamCount      int            `json:"teamCount"`
	Position       int            `json:"position"`
	Points         int            `json:"points"`
	Played         int            `json:"played"`
	Wins           int            `json:"wins"`
	Draws          int            `json:"draws"`
	Losses         int            `json:"losses"`
	GoalDifference int            `json:"goalDifference"`
	Upcoming       []MatchView    `json:"upcoming"`
	Recent         []MatchView    `json:"recent"`
	Standings      []StandingView `json:"standings"`
}

// Center is the club home summary: profile completeness, work waiting for the club, and league standings.
type Center struct {
	CompletenessPercent int      `json:"completenessPercent"`
	MissingFields       []string `json:"missingFields"`
	PendingApplications int      `json:"pendingApplications"`
	PendingNews         int      `json:"pendingNews"`
	PublishedNews       int      `json:"publishedNews"`
	// TFFLinked is true when the club picked its TFF team; with no "tff" league
	// in Leagues the federation's page could not be read just now.
	TFFLinked bool         `json:"tffLinked"`
	Leagues   []LeagueView `json:"leagues"`
}

type Counts struct {
	PendingApplications int
	PendingNews         int
	PublishedNews       int
	SquadCount          int
}

// FixtureView is one match of a week in the club's group, both sides named.
type FixtureView struct {
	ID        string     `json:"id"`
	HomeName  string     `json:"homeName"`
	AwayName  string     `json:"awayName"`
	HomeGoals *int       `json:"homeGoals"`
	AwayGoals *int       `json:"awayGoals"`
	KickoffAt *time.Time `json:"kickoffAt"`
	DateOnly  bool       `json:"dateOnly"`
	Venue     string     `json:"venue"`
	// Own marks the club's own match.
	Own bool `json:"own"`
}

// WeekView is one week (round) of the group's fixture.
type WeekView struct {
	Number  int           `json:"number"`
	Matches []FixtureView `json:"matches"`
}

// LeagueDetail is the club's Maçlarım page for one league: the summary, every
// match of the club oldest week first, and every week of the group.
type LeagueDetail struct {
	LeagueView
	Matches     []MatchView `json:"matches"`
	Weeks       []WeekView  `json:"weeks"`
	CurrentWeek int         `json:"currentWeek"`
}

// Leagues is the club's Maçlarım data: the TFF group first, then Fut Career leagues.
type Leagues struct {
	TFFLinked bool           `json:"tffLinked"`
	Leagues   []LeagueDetail `json:"leagues"`
}
