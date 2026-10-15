package domain

// Penalty shootout rules. The server owns every kick: the computer's move is
// chosen during the request that resolves the user's kick, so it never leaks.

const PenaltyRegularKicks = 5

// penaltyKeeperLean is the percent chance the keeper dives toward the side the
// user has aimed at most. Humans repeat corners, so this is where the challenge is.
const penaltyKeeperLean = 70

const (
	RoleShooter = "shooter"
	RoleKeeper  = "keeper"
)

type Side string

const (
	SideLeft   Side = "left"
	SideCenter Side = "center"
	SideRight  Side = "right"
)

var penaltySides = []Side{SideLeft, SideCenter, SideRight}

func Sides() []Side { return append([]Side(nil), penaltySides...) }

func ValidSide(side Side) bool {
	for _, s := range penaltySides {
		if s == side {
			return true
		}
	}
	return false
}

type PenaltyKick struct {
	Role     string `json:"role"`
	UserSide Side   `json:"userSide"`
	CPUSide  Side   `json:"cpuSide"`
	Scored   bool   `json:"scored"`
}

// Rand returns an integer in [0, n).
type Rand func(n int) int

type Shootout struct {
	ID            string
	Status        string
	Kicks         []PenaltyKick
	Winner        string
	RewardGranted bool
}

// RoleAt: the user shoots on even kick indexes and keeps goal on odd ones.
func RoleAt(index int) string {
	if index%2 == 0 {
		return RoleShooter
	}
	return RoleKeeper
}

func (s *Shootout) Goals() (user, cpu int) {
	for _, k := range s.Kicks {
		if !k.Scored {
			continue
		}
		if k.Role == RoleShooter {
			user++
		} else {
			cpu++
		}
	}
	return user, cpu
}

// NextRole is the role of the next kick, or empty when the shootout is over.
func (s *Shootout) NextRole() string {
	if s.Status != "active" {
		return ""
	}
	return RoleAt(len(s.Kicks))
}

func penaltyWinner(kicks []PenaltyKick) string {
	user, cpu := 0, 0
	userTaken, cpuTaken := 0, 0
	for _, k := range kicks {
		if k.Role == RoleShooter {
			userTaken++
			if k.Scored {
				user++
			}
		} else {
			cpuTaken++
			if k.Scored {
				cpu++
			}
		}
	}
	if len(kicks) < PenaltyRegularKicks*2 {
		userLeft := PenaltyRegularKicks - userTaken
		cpuLeft := PenaltyRegularKicks - cpuTaken
		if user > cpu+cpuLeft {
			return "user"
		}
		if cpu > user+userLeft {
			return "cpu"
		}
		return ""
	}
	// Sudden death: a round is only decided once both sides have kicked.
	if len(kicks)%2 == 0 && user != cpu {
		if user > cpu {
			return "user"
		}
		return "cpu"
	}
	return ""
}

// CPUSide picks the computer's move for the kick about to be played. Both sides
// lean against the user's habits: as keeper the computer dives toward the corner
// the user has aimed at most, and as shooter it aims where the user has dived least.
func CPUSide(role string, history []PenaltyKick, rnd Rand) Side {
	if role == RoleShooter {
		return leanSide(history, RoleShooter, true, rnd)
	}
	return leanSide(history, RoleKeeper, false, rnd)
}

// leanSide counts the user's moves for the given role. With the lean chance it
// picks the most (keeper) or least (shooter) used corner, otherwise it is random.
func leanSide(history []PenaltyKick, userRole string, most bool, rnd Rand) Side {
	counts := map[Side]int{}
	for _, k := range history {
		if k.Role == userRole {
			counts[k.UserSide]++
		}
	}
	if len(counts) == 0 || rnd(100) >= penaltyKeeperLean {
		return penaltySides[rnd(len(penaltySides))]
	}
	var favourites []Side
	best := -1
	for _, side := range penaltySides {
		c := counts[side]
		better := best < 0 || (most && c > best) || (!most && c < best)
		switch {
		case better:
			best = c
			favourites = []Side{side}
		case c == best:
			favourites = append(favourites, side)
		}
	}
	return favourites[rnd(len(favourites))]
}

// Apply resolves the kick at index with the user's side. A retry of an already
// resolved kick with the same side is accepted without changing the shootout.
func (s *Shootout) Apply(index int, side Side, cpu func(role string, history []PenaltyKick) Side) (bool, error) {
	if index < len(s.Kicks) {
		if s.Kicks[index].UserSide == side {
			return true, nil
		}
		return false, ErrAnswerLocked
	}
	if s.Status != "active" || index != len(s.Kicks) {
		return false, ErrQuestionOrder
	}
	role := RoleAt(index)
	cpuSide := cpu(role, s.Kicks)
	shot, dive := side, cpuSide
	if role == RoleKeeper {
		shot, dive = cpuSide, side
	}
	s.Kicks = append(s.Kicks, PenaltyKick{Role: role, UserSide: side, CPUSide: cpuSide, Scored: shot != dive})
	if winner := penaltyWinner(s.Kicks); winner != "" {
		s.Status = "finished"
		s.Winner = winner
	}
	return false, nil
}
