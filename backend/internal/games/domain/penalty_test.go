package domain_test

import (
	"errors"
	"math/rand"
	"testing"

	"futcareer/backend/internal/games/domain"
)

func fixed(side domain.Side) func(string, []domain.PenaltyKick) domain.Side {
	return func(string, []domain.PenaltyKick) domain.Side { return side }
}

func playKick(t *testing.T, s *domain.Shootout, side domain.Side, cpu domain.Side) {
	t.Helper()
	if _, err := s.Apply(len(s.Kicks), side, fixed(cpu)); err != nil {
		t.Fatal(err)
	}
}

func newShootout() *domain.Shootout {
	return &domain.Shootout{ID: "a", Status: "active"}
}

func TestKickResolutionAndRoles(t *testing.T) {
	s := newShootout()
	playKick(t, s, domain.SideLeft, domain.SideRight)    // user shoots left, keeper dives right: goal
	playKick(t, s, domain.SideCenter, domain.SideCenter) // user keeps centre, cpu shoots centre: saved
	if !s.Kicks[0].Scored || s.Kicks[0].Role != domain.RoleShooter {
		t.Fatal("shooter goal not scored")
	}
	if s.Kicks[1].Scored || s.Kicks[1].Role != domain.RoleKeeper {
		t.Fatal("keeper save counted as goal")
	}
	user, cpu := s.Goals()
	if user != 1 || cpu != 0 {
		t.Fatalf("goals %d-%d", user, cpu)
	}
}

func TestRegularWinIsDecidedEarly(t *testing.T) {
	s := newShootout()
	// user scores all three shots; cpu scores none, so after kick 6 cpu can't catch up
	for i := 0; i < 6; i++ {
		cpu := domain.SideLeft
		if i%2 == 0 {
			cpu = domain.SideRight
		}
		playKick(t, s, domain.SideLeft, cpu)
	}
	if s.Status != "finished" || s.Winner != "user" {
		t.Fatalf("expected early user win, got %s %q", s.Status, s.Winner)
	}
}

func TestSuddenDeathWaitsForWholeRound(t *testing.T) {
	s := newShootout()
	for i := 0; i < 10; i++ {
		playKick(t, s, domain.SideLeft, domain.SideLeft)
	}
	if s.Status != "active" {
		t.Fatal("tie after five each must continue")
	}
	playKick(t, s, domain.SideLeft, domain.SideRight) // user goal, round not complete yet
	if s.Status != "active" {
		t.Fatal("sudden death ended before keeper kicked")
	}
	playKick(t, s, domain.SideLeft, domain.SideLeft) // cpu saved
	if s.Status != "finished" || s.Winner != "user" {
		t.Fatal("sudden death round should decide the winner")
	}
}

func TestRetryReturnsReplayWithoutChanging(t *testing.T) {
	s := newShootout()
	playKick(t, s, domain.SideLeft, domain.SideRight)
	replayed, err := s.Apply(0, domain.SideLeft, fixed(domain.SideCenter))
	if err != nil || !replayed || len(s.Kicks) != 1 || s.Kicks[0].CPUSide != domain.SideRight {
		t.Fatal("identical retry must not resolve again")
	}
	if _, err := s.Apply(0, domain.SideRight, fixed(domain.SideCenter)); !errors.Is(err, domain.ErrAnswerLocked) {
		t.Fatal("changed answer accepted")
	}
	if _, err := s.Apply(3, domain.SideLeft, fixed(domain.SideCenter)); !errors.Is(err, domain.ErrQuestionOrder) {
		t.Fatal("future kick accepted")
	}
}

func TestKeeperLeansTowardFavouriteCorner(t *testing.T) {
	history := []domain.PenaltyKick{
		{Role: domain.RoleShooter, UserSide: domain.SideRight},
		{Role: domain.RoleKeeper, UserSide: domain.SideLeft},
		{Role: domain.RoleShooter, UserSide: domain.SideRight},
	}
	// Always 0: the lean branch is taken and the only favourite is right.
	rnd := func(int) int { return 0 }
	if got := domain.CPUSide(domain.RoleShooter, history, rnd); got != domain.SideRight {
		t.Fatalf("keeper should lean right, got %s", got)
	}
}

// simulate plays full shootouts with a user strategy and returns the user's win rate.
func simulate(seed int64, n int, userKick func(history []domain.PenaltyKick, r *rand.Rand) domain.Side) float64 {
	r := rand.New(rand.NewSource(seed))
	rnd := func(k int) int { return r.Intn(k) }
	wins := 0
	for g := 0; g < n; g++ {
		s := newShootout()
		for s.Status == "active" {
			side := userKick(s.Kicks, r)
			if _, err := s.Apply(len(s.Kicks), side, func(role string, h []domain.PenaltyKick) domain.Side {
				return domain.CPUSide(role, h, rnd)
			}); err != nil {
				panic(err)
			}
		}
		if s.Winner == "user" {
			wins++
		}
	}
	return float64(wins) / float64(n)
}

func TestDifficultyReport(t *testing.T) {
	const games = 20000
	random := func(_ []domain.PenaltyKick, r *rand.Rand) domain.Side {
		return domain.Sides()[r.Intn(3)]
	}
	// A human who keeps repeating the same corner, as players often do.
	repeater := func(_ []domain.PenaltyKick, _ *rand.Rand) domain.Side { return domain.SideLeft }
	// Shoots where the keeper has dived least, and keeps where the computer has shot most.
	adaptive := func(history []domain.PenaltyKick, _ *rand.Rand) domain.Side {
		role := domain.RoleAt(len(history))
		counts := map[domain.Side]int{}
		for _, k := range history {
			if k.Role == role {
				counts[k.CPUSide]++
			}
		}
		best := domain.SideLeft
		for _, s := range domain.Sides() {
			if (role == domain.RoleShooter && counts[s] < counts[best]) || (role == domain.RoleKeeper && counts[s] > counts[best]) {
				best = s
			}
		}
		return best
	}
	t.Logf("random user win rate:   %.1f%%", 100*simulate(1, games, random))
	t.Logf("repeating user win rate: %.1f%%", 100*simulate(2, games, repeater))
	t.Logf("adaptive user win rate:  %.1f%%", 100*simulate(3, games, adaptive))
}
