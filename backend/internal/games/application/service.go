package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"regexp"
	"sort"
	"strings"
	"time"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/games/catalog"
	"futcareer/backend/internal/games/domain"
)

type Service struct {
	repo      domain.Repository
	bank      catalog.Bank
	standings StandingsSource
}

// New wires the games. standings feeds Kafa Kafaya; without it that game
// reports the league data as unavailable.
func New(repo domain.Repository, bank catalog.Bank, standings StandingsSource) *Service {
	return &Service{repo: repo, bank: bank, standings: standings}
}

type Question struct {
	ID         string          `json:"id"`
	Difficulty string          `json:"difficulty"`
	Clubs      []domain.Club   `json:"clubs"`
	Options    []domain.Option `json:"options"`
}
type Feedback struct {
	QuestionID       string `json:"questionId"`
	SelectedOptionID string `json:"selectedOptionId"`
	CorrectOptionID  string `json:"correctOptionId"`
	CorrectName      string `json:"correctName"`
	Correct          bool   `json:"correct"`
}
type Run struct {
	ID       string    `json:"id"`
	Status   string    `json:"status"`
	Answered int       `json:"answered"`
	Score    int       `json:"score"`
	Passed   bool      `json:"passed"`
	Question *Question `json:"question"`
	Feedback *Feedback `json:"feedback"`
}
type PenaltyView struct {
	ID       string               `json:"id"`
	Status   string               `json:"status"`
	Kicks    []domain.PenaltyKick `json:"kicks"`
	Goals    PenaltyGoals         `json:"goals"`
	Winner   *string              `json:"winner"`
	NextRole string               `json:"nextRole"`
}
type PenaltyGoals struct {
	User int `json:"user"`
	CPU  int `json:"cpu"`
}

// PlayCount is one game's daily usage.
type PlayCount struct {
	Used  int `json:"used"`
	Limit int `json:"limit"`
}
type Plays struct {
	FootballGuess PlayCount `json:"footballGuess"`
	Penalty       PlayCount `json:"penalty"`
	HeadToHead    PlayCount `json:"headToHead"`
}
type State struct {
	Plays        Plays        `json:"plays"`
	NextResetAt  time.Time    `json:"nextResetAt"`
	RatingActive bool         `json:"ratingActive"`
	ServerTime   time.Time    `json:"serverTime"`
	Stats        domain.Stats `json:"stats"`
	Run          *Run         `json:"run"`
	Penalty      *PenaltyView `json:"penalty"`
}

func count(plays domain.Plays, game string) PlayCount {
	return PlayCount{Used: min(plays[game], domain.DailyPlays), Limit: domain.DailyPlays}
}

func public(value domain.State) State {
	s := State{
		Plays: Plays{
			FootballGuess: count(value.Plays, domain.GameFootballGuess),
			Penalty:       count(value.Plays, domain.GamePenalty),
			HeadToHead:    count(value.Plays, domain.GameHeadToHead),
		},
		NextResetAt: value.NextResetAt, RatingActive: value.RatingActive, ServerTime: value.ServerTime, Stats: value.Stats,
	}
	if value.Shootout != nil {
		s.Penalty = penaltyView(value.Shootout)
	}
	if value.Run == nil {
		return s
	}
	r := value.Run
	s.Run = &Run{ID: r.ID, Status: r.Status, Answered: len(r.Answers), Score: r.Score, Passed: r.Status == "finished" && r.Score >= domain.PassingScore}
	if r.Status == "active" && len(r.Answers) < len(r.Questions) {
		q := r.Questions[len(r.Answers)]
		s.Run.Question = &Question{ID: q.ID, Difficulty: q.Difficulty, Clubs: clues(q.Clubs), Options: q.Options}
	}
	if len(r.Answers) > 0 {
		a := r.Answers[len(r.Answers)-1]
		q := r.Questions[len(r.Answers)-1]
		f := &Feedback{QuestionID: a.QuestionID, SelectedOptionID: a.OptionID, CorrectOptionID: q.CorrectOptionID, Correct: a.Correct}
		for _, o := range q.Options {
			if o.ID == q.CorrectOptionID {
				f.CorrectName = o.Name
			}
		}
		s.Run.Feedback = f
	}
	return s
}

// clues re-reads crest availability from the bundled catalog, so runs saved
// before a catalog update still tell the client when to draw a name badge.
func clues(clubs []domain.Club) []domain.Club {
	out := make([]domain.Club, len(clubs))
	for i, c := range clubs {
		out[i] = domain.Club{ID: c.ID, Name: c.Name, HasCrest: catalog.HasCrest(c.ID)}
	}
	return out
}
func id() (string, error) {
	var v [16]byte
	if _, err := rand.Read(v[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(v[:]), nil
}
func shuffle[T any](values []T) error {
	for i := len(values) - 1; i > 0; i-- {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return err
		}
		j := int(n.Int64())
		values[i], values[j] = values[j], values[i]
	}
	return nil
}

// questions builds a run: per bucket, unseen players first, then the least
// recently seen; options are the answer plus three distractors drawn now.
func (s *Service) questions(seen map[string]time.Time) ([]domain.Question, error) {
	out := []domain.Question{}
	for _, step := range domain.DifficultyPlan {
		pool := []catalog.Player{}
		for _, p := range s.bank.Players {
			if p.Difficulty == step.Difficulty {
				pool = append(pool, p)
			}
		}
		for _, source := range pickPlayers(pool, seen, step.Count, intn) {
			others := distractors(source, pool, 3, intn)
			if len(others) < 3 {
				return nil, fmt.Errorf("not enough distractors for %s", source.ID)
			}
			qid, err := id()
			if err != nil {
				return nil, err
			}
			q := domain.Question{ID: qid, SourceID: source.ID, Difficulty: source.Difficulty}
			for _, club := range source.Clubs {
				c := s.bank.Clubs[club]
				q.Clubs = append(q.Clubs, domain.Club{ID: c.ID, Name: c.Name, HasCrest: c.HasCrest})
			}
			for _, p := range append([]catalog.Player{source}, others...) {
				oid, err := id()
				if err != nil {
					return nil, err
				}
				q.Options = append(q.Options, domain.Option{ID: oid, Name: p.Name})
				if p.ID == source.ID {
					q.CorrectOptionID = oid
				}
			}
			if err := shuffle(q.Options); err != nil {
				return nil, err
			}
			out = append(out, q)
		}
	}
	return out, nil
}

// pickPlayers returns n players: never-seen ones first in random order, then
// the least recently seen, so a user meets the whole pool before repeats.
func pickPlayers(pool []catalog.Player, seen map[string]time.Time, n int, intn func(int) int) []catalog.Player {
	list := append([]catalog.Player{}, pool...)
	shuffleWith(list, intn)
	sort.SliceStable(list, func(i, j int) bool {
		a, aSeen := seen[list[i].ID]
		b, bSeen := seen[list[j].ID]
		if aSeen != bSeen {
			return !aSeen
		}
		return a.Before(b)
	})
	return list[:min(n, len(list))]
}

// distractors picks n other players from the answer's bucket. Similar birth
// year (±5) ranks first, then the same position; players with the same name
// or the same clue sequence are never offered.
func distractors(answer catalog.Player, pool []catalog.Player, n int, intn func(int) int) []catalog.Player {
	clues := strings.Join(answer.Clubs, ">")
	names := map[string]bool{catalog.NameKey(answer.Name): true}
	list := []catalog.Player{}
	for _, p := range pool {
		if p.ID != answer.ID && strings.Join(p.Clubs, ">") != clues && !names[catalog.NameKey(p.Name)] {
			list = append(list, p)
		}
	}
	shuffleWith(list, intn)
	rank := func(p catalog.Player) int {
		r := 0
		if d := p.BirthYear - answer.BirthYear; d >= -5 && d <= 5 {
			r += 2
		}
		if p.Position != "" && p.Position == answer.Position {
			r++
		}
		return r
	}
	sort.SliceStable(list, func(i, j int) bool { return rank(list[i]) > rank(list[j]) })
	out := []catalog.Player{}
	for _, p := range list {
		if len(out) == n {
			break
		}
		if key := catalog.NameKey(p.Name); !names[key] {
			names[key] = true
			out = append(out, p)
		}
	}
	return out
}

func shuffleWith[T any](values []T, intn func(int) int) {
	for i := len(values) - 1; i > 0; i-- {
		j := intn(i + 1)
		values[i], values[j] = values[j], values[i]
	}
}
func (s *Service) State(ctx context.Context, userID string) (State, error) {
	value, err := s.repo.State(ctx, userID)
	return public(value), err
}
func (s *Service) Start(ctx context.Context, userID string) (State, error) {
	runID, err := id()
	if err != nil {
		return State{}, err
	}
	value, err := s.repo.Start(ctx, userID, runID, s.questions)
	return public(value), err
}

var validID = regexp.MustCompile(`^[a-f0-9]{32}$`)

func (s *Service) Answer(ctx context.Context, userID, runID, questionID, optionID string) (State, error) {
	if !validID.MatchString(runID) || !validID.MatchString(questionID) || !validID.MatchString(optionID) {
		return State{}, auth.ValidationError{"answer": "Geçerli bir soru ve seçenek seç."}
	}
	value, err := s.repo.Answer(ctx, userID, runID, questionID, optionID)
	out := public(value)
	if err == nil && value.Run != nil {
		for i, a := range value.Run.Answers {
			if a.QuestionID == questionID {
				q := value.Run.Questions[i]
				f := &Feedback{QuestionID: questionID, SelectedOptionID: a.OptionID, CorrectOptionID: q.CorrectOptionID, Correct: a.Correct}
				for _, o := range q.Options {
					if o.ID == q.CorrectOptionID {
						f.CorrectName = o.Name
					}
				}
				out.Run.Feedback = f
				break
			}
		}
	}
	return out, err
}

func penaltyView(sh *domain.Shootout) *PenaltyView {
	user, cpu := sh.Goals()
	kicks := sh.Kicks
	if kicks == nil {
		kicks = []domain.PenaltyKick{}
	}
	v := &PenaltyView{ID: sh.ID, Status: sh.Status, Kicks: kicks, Goals: PenaltyGoals{User: user, CPU: cpu}, NextRole: sh.NextRole()}
	if sh.Winner != "" {
		winner := sh.Winner
		v.Winner = &winner
	}
	return v
}

func intn(n int) int {
	v, err := rand.Int(rand.Reader, big.NewInt(int64(n)))
	if err != nil {
		panic(err)
	}
	return int(v.Int64())
}

func (s *Service) StartShootout(ctx context.Context, userID string) (State, error) {
	shootoutID, err := id()
	if err != nil {
		return State{}, err
	}
	value, err := s.repo.StartShootout(ctx, userID, shootoutID)
	return public(value), err
}

// KickShootout validates the user's side and index. The computer's move is
// chosen server-side inside the repository's locked transaction.
func (s *Service) KickShootout(ctx context.Context, userID, shootoutID string, index int, side string) (State, error) {
	if !validID.MatchString(shootoutID) || index < 0 || index > 999 || !domain.ValidSide(domain.Side(side)) {
		return State{}, auth.ValidationError{"kick": "Geçerli bir sıra ve taraf seç."}
	}
	decide := func(role string, history []domain.PenaltyKick) domain.Side {
		return domain.CPUSide(role, history, intn)
	}
	value, err := s.repo.KickShootout(ctx, userID, shootoutID, index, domain.Side(side), decide)
	return public(value), err
}
