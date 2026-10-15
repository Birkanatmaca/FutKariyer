package domain

import "time"

// NewsItem is one article written by the club, shown to administrators with its review state.
type NewsItem struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	ReviewStatus string    `json:"reviewStatus"`
	Published    bool      `json:"published"`
	CreatedAt    time.Time `json:"createdAt"`
}

// ApplicationItem is a player's request to join the club's team.
type ApplicationItem struct {
	ID         string    `json:"id"`
	PlayerName string    `json:"playerName"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"createdAt"`
}

// Overview is the administrator's one-screen view of a club account.
type Overview struct {
	Profile      Profile           `json:"profile"`
	Email        string            `json:"email"`
	Active       bool              `json:"active"`
	News         []NewsItem        `json:"news"`
	Applications []ApplicationItem `json:"applications"`
	Leagues      []LeagueView      `json:"leagues"`
}
