package domain

import (
	"context"
	"errors"
	"time"

	authdomain "futcareer/backend/internal/auth/domain"
)

var (
	ErrNotFound     = errors.New("tournament not found")
	ErrForbidden    = errors.New("tournament action not allowed for this account")
	ErrClosed       = errors.New("tournament is not accepting entries")
	ErrNotEligible  = errors.New("club type is not eligible for this tournament")
	ErrFull         = errors.New("tournament capacity reached")
	ErrDuplicate    = errors.New("club already entered this tournament")
	ErrInvalidState = errors.New("action not allowed in the current state")
	ErrNotInSquad   = errors.New("roster contains players outside the club squad")
	// Fixture and results (22 Oct 2026).
	ErrFixtureExists = errors.New("tournament already has matches")
	ErrTooFewTeams   = errors.New("fixture needs at least two accepted teams")
	ErrNotTeam       = errors.New("team is not an accepted participant")
	ErrNotInvitable  = errors.New("club cannot be invited to this tournament")
)

// Points per result; halı saha leagues use the usual 3/1/0.
const (
	WinPoints  = 3
	DrawPoints = 1
	LossPoints = 0
)

const MaxRoster = 30

var Formats = map[string]bool{"halisaha": true, "seven_a_side": true, "eleven_a_side": true}
var TeamTypes = map[string]bool{"amateur": true, "professional": true, "halisaha": true}

// Tournament dates are calendar days (YYYY-MM-DD); there is no time of day.
type Tournament struct {
	ID                  string    `json:"id"`
	OrganizerID         string    `json:"organizerId"`
	OrganizerName       string    `json:"organizerName"`
	Name                string    `json:"name"`
	Format              string    `json:"format"`
	EligibleTypes       []string  `json:"eligibleTypes"`
	District            string    `json:"district"`
	Venue               string    `json:"venue"`
	Description         string    `json:"description"`
	StartsOn            string    `json:"startsOn"`
	EndsOn              string    `json:"endsOn"`
	ApplicationDeadline string    `json:"applicationDeadline"`
	TeamCapacity        int       `json:"teamCapacity"`
	Status              string    `json:"status"`
	AcceptedTeams       int       `json:"acceptedTeams"`
	PendingEntries      int       `json:"pendingEntries"`
	CreatedAt           time.Time `json:"createdAt"`
}

type EntryPlayer struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Position string `json:"position"`
}

type Entry struct {
	ID               string        `json:"id"`
	TournamentID     string        `json:"tournamentId"`
	TournamentName   string        `json:"tournamentName"`
	TournamentStatus string        `json:"tournamentStatus"`
	ClubID           string        `json:"clubId"`
	ClubName         string        `json:"clubName"`
	ClubDistrict     string        `json:"clubDistrict"`
	ClubFootballType string        `json:"clubFootballType"`
	Message          string        `json:"message"`
	Status           string        `json:"status"`
	Players          []EntryPlayer `json:"players"`
	CreatedAt        time.Time     `json:"createdAt"`
	DecidedAt        *time.Time    `json:"decidedAt"`
}

type Page struct {
	Items      []Tournament `json:"items"`
	Page       int          `json:"page"`
	PageSize   int          `json:"pageSize"`
	Total      int          `json:"total"`
	TotalPages int          `json:"totalPages"`
}

// Team is an accepted entry as it appears in the fixture and standings.
type Team struct {
	EntryID  string `json:"entryId"`
	ClubID   string `json:"clubId"`
	Name     string `json:"name"`
	District string `json:"district"`
	Players  int    `json:"players"`
}

type Match struct {
	ID          string     `json:"id"`
	Round       int        `json:"round"`
	HomeEntryID string     `json:"homeEntryId"`
	AwayEntryID string     `json:"awayEntryId"`
	HomeName    string     `json:"homeName"`
	AwayName    string     `json:"awayName"`
	HomeClubID  string     `json:"homeClubId"`
	AwayClubID  string     `json:"awayClubId"`
	KickoffAt   *time.Time `json:"kickoffAt"`
	Venue       string     `json:"venue"`
	HomeGoals   *int       `json:"homeGoals"`
	AwayGoals   *int       `json:"awayGoals"`
}

type Standing struct {
	Position     int    `json:"position"`
	EntryID      string `json:"entryId"`
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

// Table is a tournament's teams, fixture and standings.
type Table struct {
	Tournament Tournament `json:"tournament"`
	Teams      []Team     `json:"teams"`
	Matches    []Match    `json:"matches"`
	Standings  []Standing `json:"standings"`
}

// Candidate is a club an organizer can invite.
type Candidate struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	District     string `json:"district"`
	FootballType string `json:"footballType"`
}

// Filter narrows the public tournament list. All includes running and
// finished tournaments, not only those taking entries.
type Filter struct {
	Format string
	All    bool
}

// Organizer is an organizer account as administrators see it.
type Organizer struct {
	ID          string    `json:"id"`
	FullName    string    `json:"fullName"`
	Username    string    `json:"username"`
	Email       string    `json:"email"`
	Active      bool      `json:"active"`
	Verified    bool      `json:"verified"`
	Tournaments int       `json:"tournaments"`
	CreatedAt   time.Time `json:"createdAt"`
}

type OrganizerPage struct {
	Items      []Organizer `json:"items"`
	Page       int         `json:"page"`
	PageSize   int         `json:"pageSize"`
	Total      int         `json:"total"`
	TotalPages int         `json:"totalPages"`
}

type Repository interface {
	Create(ctx context.Context, t Tournament) (Tournament, int, error)
	Mine(ctx context.Context, organizerID string) ([]Tournament, error)
	SetStatus(ctx context.Context, organizerID, id, status string) (Tournament, error)
	Entries(ctx context.Context, organizerID, tournamentID string) ([]Entry, error)
	Decide(ctx context.Context, organizerID, tournamentID, entryID string, accept bool) (Entry, error)
	List(ctx context.Context, filter Filter, page int) (Page, error)
	Get(ctx context.Context, id string) (Tournament, error)
	Enter(ctx context.Context, clubID, tournamentID, entryID, message string, playerIDs []string) (Entry, error)
	ClubEntries(ctx context.Context, clubID string) ([]Entry, error)
	Withdraw(ctx context.Context, clubID, entryID string) (Entry, error)

	// Table is public when organizerID is empty; otherwise it is the organizer's view.
	Table(ctx context.Context, organizerID, tournamentID string) (Table, error)
	GenerateFixture(ctx context.Context, organizerID, tournamentID string, legs int, ids func() (string, error)) (Table, error)
	ClearFixture(ctx context.Context, organizerID, tournamentID string) (Table, error)
	SaveMatch(ctx context.Context, organizerID, tournamentID string, m Match, create bool) (Match, error)
	DeleteMatch(ctx context.Context, organizerID, tournamentID, matchID string) error
	Candidates(ctx context.Context, organizerID, tournamentID, search string) ([]Candidate, error)
	Invite(ctx context.Context, organizerID, tournamentID, entryID, clubID, message string) (Entry, error)
	CancelInvite(ctx context.Context, organizerID, tournamentID, entryID string) (Entry, error)
	RespondInvite(ctx context.Context, clubID, entryID string, accept bool, playerIDs []string) (Entry, error)

	Organizers(ctx context.Context, page int) (OrganizerPage, error)
	CreateOrganizer(ctx context.Context, u authdomain.User) (Organizer, error)
}

// Pairing is one fixture slot before it is stored.
type Pairing struct {
	Round int
	Home  string
	Away  string
}

// RoundRobin pairs every team with every other (circle method). With two legs
// the second half repeats the first with home and away swapped. An odd team
// count gives one team a bye each round.
func RoundRobin(teams []string, legs int) []Pairing {
	ids := append([]string{}, teams...)
	if len(ids) < 2 {
		return nil
	}
	if len(ids)%2 == 1 {
		ids = append(ids, "")
	}
	n := len(ids)
	rounds := n - 1
	out := []Pairing{}
	for r := 0; r < rounds; r++ {
		for i := 0; i < n/2; i++ {
			home, away := ids[i], ids[n-1-i]
			if home == "" || away == "" {
				continue
			}
			// Alternate the fixed team's side so home games stay balanced.
			if (i == 0 && r%2 == 1) || (i > 0 && i%2 == 1) {
				home, away = away, home
			}
			out = append(out, Pairing{Round: r + 1, Home: home, Away: away})
		}
		// Rotate every team except the first.
		last := ids[n-1]
		copy(ids[2:], ids[1:n-1])
		ids[1] = last
	}
	if legs == 2 {
		first := len(out)
		for _, p := range out[:first] {
			out = append(out, Pairing{Round: p.Round + rounds, Home: p.Away, Away: p.Home})
		}
	}
	return out
}

// PlayerTournament is a tournament a player plays in through an accepted
// team roster (23 Oct 2026), with the team's next match and table position.
type PlayerTournament struct {
	Tournament Tournament `json:"tournament"`
	EntryID    string     `json:"entryId"`
	ClubID     string     `json:"clubId"`
	ClubName   string     `json:"clubName"`
	NextMatch  *Match     `json:"nextMatch"`
	Position   int        `json:"position"`
	Points     int        `json:"points"`
	Teams      int        `json:"teams"`
}

// PlayerTournaments is implemented by the PostgreSQL repository. A club
// gets its own accepted entries the same way (halı saha home card).
type PlayerTournaments interface {
	PlayerTournaments(ctx context.Context, playerID string) ([]PlayerTournament, error)
	ClubTournaments(ctx context.Context, clubID string) ([]PlayerTournament, error)
}
