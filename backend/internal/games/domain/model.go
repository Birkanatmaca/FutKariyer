package domain

import (
	"context"
	"errors"
	"time"
)

// DailyPlays is how many new games of each kind an account may start per
// Istanbul calendar day (17 Oct 2026, replaces hearts). Continuing a game in
// progress never uses a play.
const DailyPlays = 5
const QuestionCount = 10
const PassingScore = 7

// Game keys for daily plays and rating points.
const (
	GameFootballGuess = "football_guess"
	GamePenalty       = "penalty"
	GameHeadToHead    = "head_to_head"
)

var Games = []string{GameFootballGuess, GamePenalty, GameHeadToHead}

// DifficultyPlan is the order and size of each Arma İzi bucket in one run.
var DifficultyPlan = []struct {
	Difficulty string
	Count      int
}{{"easy", 4}, {"medium", 3}, {"hard", 3}}

var (
	ErrForbidden     = errors.New("game access denied")
	ErrNotFound      = errors.New("game not found")
	ErrNoPlays       = errors.New("no daily game plays left")
	ErrAnswerLocked  = errors.New("game answer already recorded")
	ErrQuestionOrder = errors.New("game question out of order")
)

// Plays is the day's usage per game key.
type Plays map[string]int

// Club is one clue in a question. HasCrest tells the client whether
// /v1/games/logos/{id} serves a crest or a name badge should be drawn.
type Club struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	HasCrest bool   `json:"hasCrest"`
}
type Option struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// Question is stored with its run. SourceID is the catalog player id; it
// stays on the server and feeds the per-user history.
type Question struct {
	ID              string   `json:"id"`
	SourceID        string   `json:"sourceId,omitempty"`
	Difficulty      string   `json:"difficulty"`
	Clubs           []Club   `json:"clubs"`
	Options         []Option `json:"options"`
	CorrectOptionID string   `json:"correctOptionId"`
}
type Answer struct {
	QuestionID string `json:"questionId"`
	OptionID   string `json:"optionId"`
	Correct    bool   `json:"correct"`
}
type Run struct {
	ID            string
	Status        string
	Questions     []Question
	Answers       []Answer
	Score         int
	RewardGranted bool
}

// Answer records only the current question. Identical retries return the saved answer.
func (r *Run) Answer(questionID, optionID string) (bool, error) {
	for _, a := range r.Answers {
		if a.QuestionID == questionID {
			if a.OptionID != optionID {
				return false, ErrAnswerLocked
			}
			return false, nil
		}
	}
	if r.Status != "active" || len(r.Answers) >= len(r.Questions) {
		return false, ErrQuestionOrder
	}
	q := r.Questions[len(r.Answers)]
	if q.ID != questionID {
		return false, ErrQuestionOrder
	}
	valid := false
	for _, o := range q.Options {
		if o.ID == optionID {
			valid = true
		}
	}
	if !valid {
		return false, ErrQuestionOrder
	}
	correct := optionID == q.CorrectOptionID
	r.Answers = append(r.Answers, Answer{QuestionID: questionID, OptionID: optionID, Correct: correct})
	if correct {
		r.Score++
	}
	if len(r.Answers) == QuestionCount {
		r.Status = "finished"
	}
	return true, nil
}

type Stats struct {
	Played    int `json:"played"`
	Wins      int `json:"wins"`
	BestScore int `json:"bestScore"`
	// SeasonPoints is the account's total in the running rating season.
	SeasonPoints int `json:"seasonPoints"`
}
type State struct {
	Plays        Plays
	NextResetAt  time.Time
	RatingActive bool
	ServerTime   time.Time
	Run          *Run
	Shootout     *Shootout
	Stats        Stats
}

// QuestionPicker builds a new run's questions from the user's history
// (catalog id -> last time it was shown). It runs inside the start
// transaction, after the daily play is used, so history and run stay consistent.
type QuestionPicker func(seen map[string]time.Time) ([]Question, error)

type Repository interface {
	State(context.Context, string) (State, error)
	Start(context.Context, string, string, QuestionPicker) (State, error)
	Answer(context.Context, string, string, string, string) (State, error)
	StartShootout(context.Context, string, string) (State, error)
	KickShootout(context.Context, string, string, int, Side, func(string, []PenaltyKick) Side) (State, error)
	HeadToHeadRecord(context.Context, string) (H2HRecord, error)
	StartHeadToHead(context.Context, string, H2HRun) (H2HRun, H2HRecord, error)
	AnswerHeadToHead(context.Context, string, string, string, Pick, NextRound) (H2HRun, int, H2HRecord, error)
}
