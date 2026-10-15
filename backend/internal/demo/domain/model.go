// Package domain describes the optional demo environment: a fixed, fictional
// set of accounts and activity that can be installed into and removed from a
// database. It is never shipped as a migration.
package domain

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"
)

const (
	// EmailDomain marks every demo account. The .test TLD is reserved and never routable.
	EmailDomain = "demo.futcareer.test"
	// UsernamePrefix marks demo club and organizer logins.
	UsernamePrefix = "demo."
)

// EmailSuffix is what demo account emails end with.
const EmailSuffix = "@" + EmailDomain

// IsDemoEmail reports whether an address belongs to the demo domain.
func IsDemoEmail(email string) bool {
	return strings.HasSuffix(strings.ToLower(strings.TrimSpace(email)), EmailSuffix)
}

// ID derives a stable 32-hex identifier, so every run produces the same rows.
func ID(kind, key string) string {
	sum := sha256.Sum256([]byte("futcareer-demo/" + kind + "/" + key))
	return hex.EncodeToString(sum[:16])
}

// UserID is the stable id of a demo account key.
func UserID(key string) string { return ID("user", key) }

// LeagueID is the demo league; leagues have no owner, so removal targets this id.
var LeagueID = ID("league", "ankara-demo-ligi")

type Account struct {
	Key            string
	ID             string
	Role           string
	FullName       string
	Email          string
	Username       string
	Active         bool
	Verified       bool
	ApprovalStatus string
	CreatedAt      time.Time
}

// Login is the identifier an operator types on the login screen.
func (a Account) Login() string {
	if a.Username != "" {
		return a.Username
	}
	return a.Email
}

type Club struct {
	UserID                string
	FootballType          string
	District              string
	Description           string
	VenueName             string
	VenueAddress          string
	TrainingGroundName    string
	TrainingGroundAddress string
	TrainingSchedule      string
	UpdatedAt             time.Time
}

type Application struct {
	UserID          string
	Role            string
	ContactName     string
	Phone           string
	District        string
	Note            string
	SubmittedAt     time.Time
	DecidedAt       *time.Time
	RejectionReason string
}

type Player struct {
	UserID          string
	BirthYear       int
	Position        string
	DominantFoot    string
	ExperienceYears int
	CurrentClub     string
	Availability    string
	Discoverable    bool
	FootballType    string
	LicenseStatus   string
	UpdatedAt       time.Time
}

type Post struct {
	ID        string
	AuthorID  string
	Body      string
	CreatedAt time.Time
}

type Like struct {
	PostID    string
	UserID    string
	CreatedAt time.Time
}

type Reply struct {
	ID        string
	PostID    string
	AuthorID  string
	Body      string
	CreatedAt time.Time
}

type Follow struct {
	ProfileID  string
	FollowerID string
	CreatedAt  time.Time
}

type View struct {
	ProfileID string
	ViewerID  string
	Day       time.Time
}

type Listing struct {
	ID          string
	ClubID      string
	Title       string
	Position    string
	Description string
	CreatedAt   time.Time
}

type JoinRequest struct {
	ID        string
	PlayerID  string
	ClubID    string
	ListingID string
	Status    string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Connection struct {
	ID          string
	SenderID    string
	RecipientID string
	PlayerID    string
	PartnerID   string
	Message     string
	Status      string
	CreatedAt   time.Time
	RespondedAt *time.Time
}

type News struct {
	ID           string
	AuthorID     string
	Title        string
	Summary      string
	Body         string
	Published    bool
	ShowOnHome   bool
	ReviewStatus string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type LeagueTeam struct {
	ID     string
	ClubID string
}

type Match struct {
	ID         string
	Round      int
	HomeTeamID string
	AwayTeamID string
	Kickoff    time.Time
	HomeGoals  *int
	AwayGoals  *int
}

type League struct {
	ID          string
	Name        string
	Season      string
	Description string
	CreatedAt   time.Time
	Teams       []LeagueTeam
	Matches     []Match
}

type Entry struct {
	ID        string
	ClubID    string
	Message   string
	Status    string
	CreatedAt time.Time
	DecidedAt *time.Time
	PlayerIDs []string
}

type Tournament struct {
	ID                  string
	OrganizerID         string
	Name                string
	Format              string
	EligibleTypes       []string
	District            string
	Venue               string
	Description         string
	StartsOn            string
	EndsOn              string
	ApplicationDeadline string
	TeamCapacity        int
	CreatedAt           time.Time
	Entries             []Entry
}

// Notification is an in-app notification with the time it should appear to have happened.
type Notification struct {
	ID          string
	RecipientID string
	Kind        string
	Title       string
	Body        string
	ResourceID  string
	SourceKey   string
	CreatedAt   time.Time
	Read        bool
}

type Dataset struct {
	// Now is the clock the dataset was built against.
	Now           time.Time
	Accounts      []Account
	Clubs         []Club
	Applications  []Application
	Players       []Player
	Posts         []Post
	Likes         []Like
	Replies       []Reply
	Follows       []Follow
	Views         []View
	Listings      []Listing
	JoinRequests  []JoinRequest
	Connections   []Connection
	News          []News
	League        League
	Tournament    Tournament
	Notifications []Notification
}

// Account returns the account with the given key.
func (d Dataset) Account(key string) (Account, bool) {
	for _, a := range d.Accounts {
		if a.Key == key {
			return a, true
		}
	}
	return Account{}, false
}

// Counts are the demo rows present in a database; Status and tests compare them.
type Counts struct {
	Players              int
	ActiveClubs          int
	Organizers           int
	PendingApplications  int
	RejectedApplications int
	Posts                int
	Likes                int
	Replies              int
	Follows              int
	ProfileViews         int
	Listings             int
	JoinPending          int
	JoinAccepted         int
	JoinRejected         int
	SquadMembers         int
	Connections          int
	NewsPublished        int
	NewsPending          int
	LeagueTeams          int
	MatchesPlayed        int
	MatchesScheduled     int
	Tournaments          int
	TournamentEntries    int
	Notifications        int
}

// Expected returns the counts the dataset itself should produce.
func (d Dataset) Expected() Counts {
	var c Counts
	for _, a := range d.Accounts {
		switch {
		case a.Role == "player":
			c.Players++
		case a.ApprovalStatus == "pending":
			c.PendingApplications++
		case a.ApprovalStatus == "rejected":
			c.RejectedApplications++
		case a.Role == "club":
			c.ActiveClubs++
		case a.Role == "organizer":
			c.Organizers++
		}
	}
	c.Posts, c.Likes, c.Replies, c.Follows, c.ProfileViews, c.Listings = len(d.Posts), len(d.Likes), len(d.Replies), len(d.Follows), len(d.Views), len(d.Listings)
	for _, r := range d.JoinRequests {
		switch r.Status {
		case "pending":
			c.JoinPending++
		case "accepted":
			c.JoinAccepted++
			c.SquadMembers++
		case "rejected":
			c.JoinRejected++
		}
	}
	c.Connections = len(d.Connections)
	for _, n := range d.News {
		if n.Published {
			c.NewsPublished++
		} else if n.ReviewStatus == "pending" {
			c.NewsPending++
		}
	}
	c.LeagueTeams = len(d.League.Teams)
	for _, m := range d.League.Matches {
		if m.HomeGoals != nil {
			c.MatchesPlayed++
		} else {
			c.MatchesScheduled++
		}
	}
	c.Tournaments = 1
	c.TournamentEntries = len(d.Tournament.Entries)
	c.Notifications = len(d.Notifications)
	return c
}

// ErrFollowTarget means the --follow-email account cannot receive demo activity.
var ErrFollowTarget = errors.New("follow target must be an existing, active, non-demo player, club or coach account")

// FollowResult reports what was added for the --follow-email account.
type FollowResult struct {
	Name        string
	Role        string
	Follows     int
	Connections int
	Likes       int
	Visits      int
}
