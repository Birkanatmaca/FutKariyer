package domain

import (
	"errors"
	"sort"
)

// Kafa Kafaya: two real clubs from one league and a single comparison. The
// server keeps the values; the client only learns them after its pick is saved.

var ErrNoPairs = errors.New("no head-to-head pair available")

type Pick string

const (
	PickLeft  Pick = "left"
	PickRight Pick = "right"
)

func ValidPick(p Pick) bool { return p == PickLeft || p == PickRight }

// Metric is one standings column. LowerWins marks columns where the smaller
// value wins the comparison (rank, goals conceded).
type Metric struct {
	Key       string
	Label     string
	LowerWins bool
	Value     func(H2HClub) int
}

var Metrics = []Metric{
	{Key: "points", Label: "Daha çok puanı olan?", Value: func(c H2HClub) int { return c.Points }},
	{Key: "goalsFor", Label: "Daha çok gol atan?", Value: func(c H2HClub) int { return c.GoalsFor }},
	{Key: "goalsAgainst", Label: "Daha az gol yiyen?", LowerWins: true, Value: func(c H2HClub) int { return c.GoalsAgainst }},
	{Key: "rank", Label: "Ligde daha üstte olan?", LowerWins: true, Value: func(c H2HClub) int { return c.Rank }},
	{Key: "won", Label: "Daha çok galibiyeti olan?", Value: func(c H2HClub) int { return c.Won }},
	{Key: "goalDiff", Label: "Averajı daha iyi olan?", Value: func(c H2HClub) int { return c.GoalDiff }},
}

func MetricByKey(key string) (Metric, bool) {
	for _, m := range Metrics {
		if m.Key == key {
			return m, true
		}
	}
	return Metric{}, false
}

// H2HClub is one standings row as the game needs it.
type H2HClub struct {
	Name         string
	LogoURL      string
	Rank         int
	Points       int
	GoalsFor     int
	GoalsAgainst int
	Won          int
	GoalDiff     int
}

type H2HLeague struct {
	Slug    string `json:"slug"`
	Name    string `json:"name"`
	LogoURL string `json:"logoUrl"`
}

type H2HSide struct {
	Name    string `json:"name"`
	LogoURL string `json:"logoUrl"`
	Value   int    `json:"value"`
}

// H2HRound is the stored round. Values and the saved pick never leave the
// server until that round is answered.
type H2HRound struct {
	ID       string    `json:"id"`
	League   H2HLeague `json:"league"`
	Metric   string    `json:"metric"`
	Label    string    `json:"label"`
	Left     H2HSide   `json:"left"`
	Right    H2HSide   `json:"right"`
	Pick     Pick      `json:"pick,omitempty"`
	Correct  bool      `json:"correct"`
	Answered bool      `json:"answered"`
}

// Winner is the side that wins the round's comparison. Rounds are generated
// with different values, so there is always exactly one winner.
func (r H2HRound) Winner() Pick {
	m, _ := MetricByKey(r.Metric)
	leftWins := r.Left.Value > r.Right.Value
	if m.LowerWins {
		leftWins = r.Left.Value < r.Right.Value
	}
	if leftWins {
		return PickLeft
	}
	return PickRight
}

// PairKey identifies a pair regardless of side so a run never repeats it.
func PairKey(league, a, b string) string {
	names := []string{a, b}
	sort.Strings(names)
	return league + "|" + names[0] + "|" + names[1]
}

func (r H2HRound) PairKey() string { return PairKey(r.League.Slug, r.Left.Name, r.Right.Name) }

// NewRound picks an unused pair and a metric on which the two clubs differ.
// Pair order, metric order and sides are all random.
func NewRound(id string, league H2HLeague, clubs []H2HClub, used map[string]bool, rnd Rand) (H2HRound, error) {
	type pair struct{ a, b int }
	pairs := []pair{}
	for i := range clubs {
		for j := i + 1; j < len(clubs); j++ {
			if clubs[i].Name == "" || clubs[j].Name == "" || clubs[i].Name == clubs[j].Name {
				continue
			}
			if used[PairKey(league.Slug, clubs[i].Name, clubs[j].Name)] {
				continue
			}
			pairs = append(pairs, pair{i, j})
		}
	}
	shuffleWith(pairs, rnd)
	for _, p := range pairs {
		metrics := append([]Metric(nil), Metrics...)
		shuffleWith(metrics, rnd)
		for _, m := range metrics {
			a, b := clubs[p.a], clubs[p.b]
			if m.Value(a) == m.Value(b) {
				continue
			}
			if rnd(2) == 1 {
				a, b = b, a
			}
			return H2HRound{
				ID:     id,
				League: league,
				Metric: m.Key,
				Label:  m.Label,
				Left:   H2HSide{Name: a.Name, LogoURL: a.LogoURL, Value: m.Value(a)},
				Right:  H2HSide{Name: b.Name, LogoURL: b.LogoURL, Value: m.Value(b)},
			}, nil
		}
	}
	return H2HRound{}, ErrNoPairs
}

func shuffleWith[T any](values []T, rnd Rand) {
	for i := len(values) - 1; i > 0; i-- {
		j := rnd(i + 1)
		values[i], values[j] = values[j], values[i]
	}
}

type H2HRun struct {
	ID     string
	Status string
	Streak int
	Rounds []H2HRound
}

// Current is the unanswered round of an active run.
func (r *H2HRun) Current() *H2HRound {
	if r.Status != "active" || len(r.Rounds) == 0 || r.Rounds[len(r.Rounds)-1].Answered {
		return nil
	}
	return &r.Rounds[len(r.Rounds)-1]
}

func (r *H2HRun) Used() map[string]bool {
	used := map[string]bool{}
	for _, round := range r.Rounds {
		used[round.PairKey()] = true
	}
	return used
}

// NextRound builds the round that follows a correct answer. It receives the
// pairs already used in the run.
type NextRound func(used map[string]bool) (H2HRound, error)

// Answer saves the pick for the current round. A repeated identical pick
// returns the saved result (changed=false); a different pick is refused.
// A correct pick adds a new round; a wrong one ends the run.
func (r *H2HRun) Answer(roundID string, pick Pick, next NextRound) (index int, changed bool, err error) {
	for i, round := range r.Rounds {
		if round.ID != roundID {
			continue
		}
		if round.Answered {
			if round.Pick != pick {
				return i, false, ErrAnswerLocked
			}
			return i, false, nil
		}
		if r.Status != "active" || i != len(r.Rounds)-1 {
			return i, false, ErrQuestionOrder
		}
		correct := round.Winner() == pick
		if correct {
			if next == nil {
				return i, false, ErrNoPairs
			}
			following, err := next(r.Used())
			if err != nil {
				return i, false, err
			}
			r.Streak++
			r.Rounds[i].Pick, r.Rounds[i].Correct, r.Rounds[i].Answered = pick, true, true
			r.Rounds = append(r.Rounds, following)
		} else {
			r.Rounds[i].Pick, r.Rounds[i].Correct, r.Rounds[i].Answered = pick, false, true
			r.Status = "finished"
		}
		return i, true, nil
	}
	return 0, false, ErrQuestionOrder
}

type H2HRecord struct {
	Best  int `json:"best"`
	Plays int `json:"plays"`
}
