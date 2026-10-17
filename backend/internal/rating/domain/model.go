// Package domain holds the global rating (17 Oct 2026): monthly seasons with
// prizes for the top three, points from games and tasks, and a leaderboard.
package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrForbidden      = errors.New("rating access denied")
	ErrNotFound       = errors.New("rating item not found")
	ErrOverlap        = errors.New("published rating seasons overlap")
	ErrNoSeason       = errors.New("no active rating season")
	ErrTaskIncomplete = errors.New("rating task not complete")
	ErrTaskInactive   = errors.New("rating task inactive")
)

// Point sources. Games award one point per correct answer or scored goal.
const (
	SourceFootballGuess = "football_guess"
	SourcePenalty       = "penalty"
	SourceHeadToHead    = "head_to_head"
	SourceTask          = "task"
)

// Task kinds the server can measure inside a season window.
const (
	TaskPlayGames      = "play_games"
	TaskSharePost      = "share_post"
	TaskFollowAccounts = "follow_accounts"
	TaskH2HStreak      = "h2h_streak"
)

var TaskKinds = []string{TaskPlayGames, TaskSharePost, TaskFollowAccounts, TaskH2HStreak}

func ValidTaskKind(kind string) bool {
	for _, k := range TaskKinds {
		if k == kind {
			return true
		}
	}
	return false
}

const (
	LeaderboardSize = 50
	PrizePlaces     = 3
)

type Prize struct {
	Place int    `json:"place"`
	Title string `json:"title"`
}

type Season struct {
	ID          string
	Title       string
	Description string
	StartsAt    time.Time
	EndsAt      time.Time
	Prizes      []Prize
	Published   bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
	Players     int
}

// Status is derived from the window: upcoming, active or finished.
func (s Season) Status(now time.Time) string {
	switch {
	case !s.Published:
		return "draft"
	case now.Before(s.StartsAt):
		return "upcoming"
	case now.Before(s.EndsAt):
		return "active"
	default:
		return "finished"
	}
}

type Task struct {
	Kind   string
	Active bool
	Target int
	Points int
}

// TaskProgress is one task as an account sees it inside a season.
type TaskProgress struct {
	Task
	Progress int
	Claimed  bool
}

type Standing struct {
	Rank     int
	UserID   string
	FullName string
	Role     string
	Points   int
}

// Board is what an account sees: the current (or next, or last) season, its
// leaderboard, the account's own place and the tasks.
type Board struct {
	Season     *Season
	ServerTime time.Time
	Top        []Standing
	Me         *Standing
	Tasks      []TaskProgress
}

type Repository interface {
	Board(ctx context.Context, userID string) (Board, error)
	ClaimTask(ctx context.Context, userID, kind string) (Board, error)
	Seasons(ctx context.Context) ([]Season, time.Time, error)
	CreateSeason(ctx context.Context, s Season) (Season, error)
	UpdateSeason(ctx context.Context, s Season) (Season, error)
	DeleteSeason(ctx context.Context, id string) error
	SeasonBoard(ctx context.Context, id string) (Season, []Standing, error)
	Tasks(ctx context.Context) ([]Task, error)
	UpdateTask(ctx context.Context, t Task) (Task, error)
}
