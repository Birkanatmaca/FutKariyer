package domain

import (
	"context"
	"errors"
	"time"
)

const MaxHearts = 3
const HeartInterval = 6 * time.Hour
const QuestionCount = 10
const PassingScore = 7

// DifficultyPlan is the order and size of each Arma İzi bucket in one run.
var DifficultyPlan = []struct {
	Difficulty string
	Count      int
}{{"easy", 4}, {"medium", 3}, {"hard", 3}}

var (
	ErrForbidden     = errors.New("game access denied")
	ErrNotFound      = errors.New("game not found")
	ErrNoHearts      = errors.New("no game hearts available")
	ErrAnswerLocked  = errors.New("game answer already recorded")
	ErrQuestionOrder = errors.New("game question out of order")
)

type Wallet struct {
	Hearts       int
	RefillAnchor *time.Time
}

// Refill preserves the partial interval and stops accruing time at full capacity.
func (w Wallet) Refill(now time.Time) Wallet {
	if w.Hearts >= MaxHearts {
		return Wallet{Hearts: MaxHearts}
	}
	if w.RefillAnchor == nil || now.Before(*w.RefillAnchor) {
		return w
	}
	steps := int(now.Sub(*w.RefillAnchor) / HeartInterval)
	if steps == 0 {
		return w
	}
	w.Hearts += steps
	if w.Hearts >= MaxHearts {
		return Wallet{Hearts: MaxHearts}
	}
	anchor := w.RefillAnchor.Add(time.Duration(steps) * HeartInterval)
	w.RefillAnchor = &anchor
	return w
}

// Grant adds hearts from a gift. Hearts are capped at MaxHearts, and a partial
// refill interval starts when the first missing heart appears.
func (w Wallet) Grant(hearts int, now time.Time) Wallet {
	w = w.Refill(now)
	w.Hearts += hearts
	if w.Hearts >= MaxHearts {
		return Wallet{Hearts: MaxHearts}
	}
	if w.RefillAnchor == nil {
		anchor := now
		w.RefillAnchor = &anchor
	}
	return w
}

func (w Wallet) Spend(now time.Time) (Wallet, error) {
	w = w.Refill(now)
	if w.Hearts < 1 {
		return w, ErrNoHearts
	}
	if w.Hearts == MaxHearts || w.RefillAnchor == nil {
		anchor := now
		w.RefillAnchor = &anchor
	}
	w.Hearts--
	return w, nil
}

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
	Played        int `json:"played"`
	Wins          int `json:"wins"`
	BestScore     int `json:"bestScore"`
	EarnedCredits int `json:"earnedCredits"`
}
type State struct {
	Wallet         Wallet
	ServerTime     time.Time
	Run            *Run
	Shootout       *Shootout
	Stats          Stats
	RewardEligible bool
}

// QuestionPicker builds a new run's questions from the user's history
// (catalog id -> last time it was shown). It runs inside the start
// transaction, after the heart is spent, so history and run stay consistent.
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
