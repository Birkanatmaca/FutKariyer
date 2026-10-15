package domain

import (
	"context"
	"errors"
	"time"
)

var ErrNotFound = errors.New("league record not found")
var ErrTeamHasMatches = errors.New("league team still has scheduled matches")

type League struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Season      string    `json:"season"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	WinPoints   int       `json:"winPoints"`
	DrawPoints  int       `json:"drawPoints"`
	LossPoints  int       `json:"lossPoints"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type ClubOption struct {
	ID       string `json:"id"`
	FullName string `json:"fullName"`
}

type Team struct {
	ID       string `json:"id"`
	ClubID   string `json:"clubId"`
	Name     string `json:"name"`
	District string `json:"district"`
}

type Match struct {
	ID         string     `json:"id"`
	Round      int        `json:"round"`
	HomeTeamID string     `json:"homeTeamId"`
	AwayTeamID string     `json:"awayTeamId"`
	HomeName   string     `json:"homeName"`
	AwayName   string     `json:"awayName"`
	KickoffAt  *time.Time `json:"kickoffAt"`
	HomeGoals  *int       `json:"homeGoals"`
	AwayGoals  *int       `json:"awayGoals"`
}

type Standing struct {
	Position     int    `json:"position"`
	TeamID       string `json:"teamId"`
	ClubID       string `json:"clubId"`
	TeamName     string `json:"teamName"`
	Played       int    `json:"played"`
	Wins         int    `json:"wins"`
	Draws        int    `json:"draws"`
	Losses       int    `json:"losses"`
	GoalsFor     int    `json:"goalsFor"`
	GoalsAgainst int    `json:"goalsAgainst"`
	GoalDiff     int    `json:"goalDifference"`
	Points       int    `json:"points"`
}

type Statistics struct {
	TeamCount        int     `json:"teamCount"`
	MatchCount       int     `json:"matchCount"`
	PlayedMatches    int     `json:"playedMatches"`
	ScheduledMatches int     `json:"scheduledMatches"`
	TotalGoals       int     `json:"totalGoals"`
	AverageGoals     float64 `json:"averageGoals"`
	HomeWins         int     `json:"homeWins"`
	Draws            int     `json:"draws"`
	AwayWins         int     `json:"awayWins"`
}

type Detail struct {
	League     League     `json:"league"`
	Teams      []Team     `json:"teams"`
	Matches    []Match    `json:"matches"`
	Standings  []Standing `json:"standings"`
	Statistics Statistics `json:"statistics"`
}

type Page[T any] struct {
	Items      []T `json:"items"`
	Page       int `json:"page"`
	PageSize   int `json:"pageSize"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

type Repository interface {
	List(context.Context, bool, int) (Page[League], error)
	Get(context.Context, string, bool) (Detail, error)
	Save(context.Context, League, bool) (League, error)
	Delete(context.Context, string) error
	Clubs(context.Context, string, int) (Page[ClubOption], error)
	AddTeam(context.Context, string, string, string) (Team, error)
	RemoveTeam(context.Context, string, string) error
	SaveMatch(context.Context, string, Match, bool) (Match, error)
	DeleteMatch(context.Context, string, string) error
}
