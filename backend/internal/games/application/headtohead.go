package application

import (
	"context"
	"time"

	auth "futcareer/backend/internal/auth/application"
	footballdomain "futcareer/backend/internal/football/domain"
	"futcareer/backend/internal/games/domain"
)

// StandingsSource is the narrow part of the football service Kafa Kafaya
// needs. Standings are cached there, so a round costs no extra upstream call
// in the common case.
type StandingsSource interface {
	Standings(ctx context.Context, slug string) (footballdomain.Standings, error)
}

// H2HTeam and H2HRoundView are what the client sees before answering: no
// values, no winner.
type H2HTeam struct {
	Name    string `json:"name"`
	LogoURL string `json:"logoUrl"`
}
type H2HQuestion struct {
	Metric string `json:"metric"`
	Label  string `json:"label"`
}
type H2HLeagueView struct {
	Name    string `json:"name"`
	LogoURL string `json:"logoUrl"`
}
type H2HRoundView struct {
	ID       string        `json:"id"`
	League   H2HLeagueView `json:"league"`
	Question H2HQuestion   `json:"question"`
	Left     H2HTeam       `json:"left"`
	Right    H2HTeam       `json:"right"`
}
type H2HStart struct {
	ID     string       `json:"id"`
	Streak int          `json:"streak"`
	Best   int          `json:"best"`
	Plays  int          `json:"plays"`
	Round  H2HRoundView `json:"round"`
}
type H2HValues struct {
	Left  int `json:"left"`
	Right int `json:"right"`
}
type H2HResult struct {
	RoundID   string        `json:"roundId"`
	Pick      domain.Pick   `json:"pick"`
	Correct   bool          `json:"correct"`
	Values    H2HValues     `json:"values"`
	Streak    int           `json:"streak"`
	Best      int           `json:"best"`
	GameOver  bool          `json:"gameOver"`
	NextRound *H2HRoundView `json:"nextRound"`
}

func roundView(r domain.H2HRound) H2HRoundView {
	return H2HRoundView{
		ID:       r.ID,
		League:   H2HLeagueView{Name: r.League.Name, LogoURL: r.League.LogoURL},
		Question: H2HQuestion{Metric: r.Metric, Label: r.Label},
		Left:     H2HTeam{Name: r.Left.Name, LogoURL: r.Left.LogoURL},
		Right:    H2HTeam{Name: r.Right.Name, LogoURL: r.Right.LogoURL},
	}
}

// h2hLeague loads one random major league's standings. Leagues without rows
// (e.g. a season break) or whose source fails are skipped, so one slow league
// does not stop the game; the error is returned only when every league fails.
// Each attempt is capped so the whole request stays within the server's write timeout.
func (s *Service) h2hLeague(ctx context.Context) (domain.H2HLeague, []domain.H2HClub, error) {
	if s.standings == nil {
		return domain.H2HLeague{}, nil, footballdomain.ErrUpstream
	}
	leagues := append([]footballdomain.Competition(nil), footballdomain.Competitions...)
	if err := shuffle(leagues); err != nil {
		return domain.H2HLeague{}, nil, err
	}
	lastErr := footballdomain.ErrUpstream
	for _, c := range leagues {
		attempt, cancel := context.WithTimeout(ctx, h2hLeagueTimeout)
		st, err := s.standings.Standings(attempt, c.Slug)
		cancel()
		if err != nil {
			lastErr = err
			if ctx.Err() != nil {
				break
			}
			continue
		}
		clubs := make([]domain.H2HClub, 0, len(st.Rows))
		for _, row := range st.Rows {
			if row.Team.Name == "" {
				continue
			}
			clubs = append(clubs, domain.H2HClub{Name: row.Team.Name, LogoURL: row.Team.LogoURL, Rank: row.Rank, Points: row.Points, GoalsFor: row.GoalsFor, GoalsAgainst: row.GoalsAgainst, Won: row.Won, GoalDiff: row.GoalDiff})
		}
		if len(clubs) >= 2 {
			return domain.H2HLeague{Slug: c.Slug, Name: c.Name, LogoURL: c.LogoURL}, clubs, nil
		}
	}
	return domain.H2HLeague{}, nil, lastErr
}

const h2hLeagueTimeout = 4 * time.Second

// nextRound prepares a generator from already loaded standings, so the
// repository can build the following round inside its lock without network.
func (s *Service) nextRound(ctx context.Context) (domain.NextRound, error) {
	league, clubs, err := s.h2hLeague(ctx)
	if err != nil {
		return nil, err
	}
	return func(used map[string]bool) (domain.H2HRound, error) {
		roundID, err := id()
		if err != nil {
			return domain.H2HRound{}, err
		}
		return domain.NewRound(roundID, league, clubs, used, intn)
	}, nil
}

func (s *Service) HeadToHead(ctx context.Context, userID string) (domain.H2HRecord, error) {
	return s.repo.HeadToHeadRecord(ctx, userID)
}

func (s *Service) StartHeadToHead(ctx context.Context, userID string) (H2HStart, error) {
	next, err := s.nextRound(ctx)
	if err != nil {
		return H2HStart{}, err
	}
	first, err := next(map[string]bool{})
	if err != nil {
		return H2HStart{}, err
	}
	runID, err := id()
	if err != nil {
		return H2HStart{}, err
	}
	run, rec, err := s.repo.StartHeadToHead(ctx, userID, domain.H2HRun{ID: runID, Status: "active", Rounds: []domain.H2HRound{first}})
	if err != nil {
		return H2HStart{}, err
	}
	return H2HStart{ID: run.ID, Streak: run.Streak, Best: rec.Best, Plays: rec.Plays, Round: roundView(run.Rounds[len(run.Rounds)-1])}, nil
}

// AnswerHeadToHead records a pick. Standings for a possible next round are
// loaded first; if they are unavailable a wrong pick still ends the run, while
// a correct one returns the upstream error and stays unanswered for a retry.
func (s *Service) AnswerHeadToHead(ctx context.Context, userID, runID, roundID, pick string) (H2HResult, error) {
	if !validID.MatchString(runID) || !validID.MatchString(roundID) || !domain.ValidPick(domain.Pick(pick)) {
		return H2HResult{}, auth.ValidationError{"answer": "Geçerli bir tur ve seçim gönder."}
	}
	next, loadErr := s.nextRound(ctx)
	var generate domain.NextRound
	if loadErr == nil {
		generate = next
	} else {
		generate = func(map[string]bool) (domain.H2HRound, error) { return domain.H2HRound{}, loadErr }
	}
	run, index, rec, err := s.repo.AnswerHeadToHead(ctx, userID, runID, roundID, domain.Pick(pick), generate)
	if err != nil {
		return H2HResult{}, err
	}
	round := run.Rounds[index]
	out := H2HResult{
		RoundID:  round.ID,
		Pick:     round.Pick,
		Correct:  round.Correct,
		Values:   H2HValues{Left: round.Left.Value, Right: round.Right.Value},
		Streak:   index,
		Best:     rec.Best,
		GameOver: !round.Correct,
	}
	// The streak shown is the one right after this round, so a replayed
	// answer reports the same numbers as the first reply.
	if round.Correct {
		out.Streak = index + 1
		following := roundView(run.Rounds[index+1])
		out.NextRound = &following
	}
	return out, nil
}
