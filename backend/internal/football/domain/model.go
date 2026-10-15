package domain

import (
	"errors"
	"time"
)

var (
	ErrUnknownCompetition = errors.New("unknown competition")
	ErrUpstream           = errors.New("football data source unavailable")
	ErrInvalidSelection   = errors.New("invalid TFF Ankara selection")
)

// Competition is one of the major leagues or UEFA cups served from ESPN's public site API.
type Competition struct {
	Slug    string `json:"slug"`
	Name    string `json:"name"`
	Country string `json:"country"`
	LogoURL string `json:"logoUrl"`
	// Code is ESPN's league code, e.g. tur.1.
	Code string `json:"-"`
}

// Competitions is the fixed display order: Süper Lig first, then the five
// major European leagues. Kafa Kafaya draws its rounds only from this list.
var Competitions = []Competition{
	{Slug: "super-lig", Name: "Trendyol Süper Lig", Country: "Türkiye", Code: "tur.1", LogoURL: "https://a.espncdn.com/i/leaguelogos/soccer/500/18.png"},
	{Slug: "premier-league", Name: "Premier League", Country: "İngiltere", Code: "eng.1", LogoURL: "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png"},
	{Slug: "la-liga", Name: "La Liga", Country: "İspanya", Code: "esp.1", LogoURL: "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png"},
	{Slug: "serie-a", Name: "Serie A", Country: "İtalya", Code: "ita.1", LogoURL: "https://a.espncdn.com/i/leaguelogos/soccer/500/12.png"},
	{Slug: "bundesliga", Name: "Bundesliga", Country: "Almanya", Code: "ger.1", LogoURL: "https://a.espncdn.com/i/leaguelogos/soccer/500/10.png"},
	{Slug: "ligue-1", Name: "Ligue 1", Country: "Fransa", Code: "fra.1", LogoURL: "https://a.espncdn.com/i/leaguelogos/soccer/500/9.png"},
}

// Cups are the three UEFA club competitions, shown as a separate group under
// the leagues. Their standings are the 36-team league phase.
var Cups = []Competition{
	{Slug: "champions-league", Name: "Şampiyonlar Ligi", Country: "UEFA", Code: "uefa.champions", LogoURL: "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png"},
	{Slug: "europa-league", Name: "Avrupa Ligi", Country: "UEFA", Code: "uefa.europa", LogoURL: "https://a.espncdn.com/i/leaguelogos/soccer/500/2310.png"},
	{Slug: "conference-league", Name: "Konferans Ligi", Country: "UEFA", Code: "uefa.europa.conf", LogoURL: "https://a.espncdn.com/i/leaguelogos/soccer/500/20296.png"},
}

// CompetitionBySlug finds a league or a cup.
func CompetitionBySlug(slug string) (Competition, bool) {
	for _, list := range [][]Competition{Competitions, Cups} {
		for _, c := range list {
			if c.Slug == slug {
				return c, true
			}
		}
	}
	return Competition{}, false
}

type Team struct {
	Name    string `json:"name"`
	LogoURL string `json:"logoUrl"`
}

type StandingRow struct {
	Rank         int    `json:"rank"`
	Team         Team   `json:"team"`
	Played       int    `json:"played"`
	Won          int    `json:"won"`
	Drawn        int    `json:"drawn"`
	Lost         int    `json:"lost"`
	GoalsFor     int    `json:"goalsFor"`
	GoalsAgainst int    `json:"goalsAgainst"`
	GoalDiff     int    `json:"goalDiff"`
	Points       int    `json:"points"`
	Form         string `json:"form"`
	Group        string `json:"group"`
	Description  string `json:"description"`
}

type Standings struct {
	Season    string        `json:"season"`
	Rows      []StandingRow `json:"rows"`
	UpdatedAt time.Time     `json:"updatedAt"`
}

// Fixture status is normalised to live, finished, scheduled or other.
type Fixture struct {
	ID          int       `json:"id"`
	Kickoff     time.Time `json:"kickoff"`
	Status      string    `json:"status"`
	StatusLabel string    `json:"statusLabel"`
	Elapsed     *int      `json:"elapsed"`
	Round       string    `json:"round"`
	Home        Team      `json:"home"`
	Away        Team      `json:"away"`
	HomeGoals   *int      `json:"homeGoals"`
	AwayGoals   *int      `json:"awayGoals"`
}

// Live holds today's matches (Türkiye date) with live state and minute.
type Live struct {
	Date      string    `json:"date"`
	Items     []Fixture `json:"items"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Results holds the league's most recent finished matches, newest first.
type Results struct {
	Season    string    `json:"season"`
	Items     []Fixture `json:"items"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type PlayerStat struct {
	Rank        int    `json:"rank"`
	Name        string `json:"name"`
	PhotoURL    string `json:"photoUrl"`
	Team        Team   `json:"team"`
	Value       int    `json:"value"`
	Appearances int    `json:"appearances"`
}

type Stats struct {
	Season     string       `json:"season"`
	TopScorers []PlayerStat `json:"topScorers"`
	TopAssists []PlayerStat `json:"topAssists"`
	UpdatedAt  time.Time    `json:"updatedAt"`
}

// TFF Ankara amateur leagues (scraped from the public standings page).

type Option struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Selected bool   `json:"selected"`
}

type AnkaraMatch struct {
	Date      string `json:"date"`
	Time      string `json:"time"`
	Venue     string `json:"venue"`
	Home      string `json:"home"`
	Away      string `json:"away"`
	HomeGoals *int   `json:"homeGoals"`
	AwayGoals *int   `json:"awayGoals"`
	Status    string `json:"status"`
}

type AnkaraWeek struct {
	Number  int           `json:"number"`
	Matches []AnkaraMatch `json:"matches"`
}

type AnkaraTable struct {
	Seasons     []Option      `json:"seasons"`
	Leagues     []Option      `json:"leagues"`
	Groups      []Option      `json:"groups"`
	Standings   []StandingRow `json:"standings"`
	Weeks       []AnkaraWeek  `json:"weeks"`
	CurrentWeek int           `json:"currentWeek"`
	Source      string        `json:"source"`
	UpdatedAt   time.Time     `json:"updatedAt"`
}

// AnkaraBulletin is the weekly match programme of every TFF Ankara league
// (sistem.tffankara.org/home/onaylibulten), grouped by day and venue.
type AnkaraBulletin struct {
	Days      []BulletinDay `json:"days"`
	Leagues   []string      `json:"leagues"`
	Source    string        `json:"source"`
	UpdatedAt time.Time     `json:"updatedAt"`
}

type BulletinDay struct {
	Date   string          `json:"date"`
	Venues []BulletinVenue `json:"venues"`
}

type BulletinVenue struct {
	Name    string          `json:"name"`
	Matches []BulletinMatch `json:"matches"`
}

type BulletinMatch struct {
	Time   string `json:"time"`
	Home   string `json:"home"`
	Away   string `json:"away"`
	League string `json:"league"`
}

// AnkaraPost is an announcement of the TFF Ankara website. Only plain text and
// links to the site's own uploads are kept; the post HTML is never passed on.
type AnkaraPost struct {
	ID          int          `json:"id"`
	Kind        string       `json:"kind"`
	Title       string       `json:"title"`
	Date        string       `json:"date"`
	URL         string       `json:"url"`
	Attachments []Attachment `json:"attachments"`
}

type Attachment struct {
	Name string `json:"name"`
	URL  string `json:"url"`
	Type string `json:"type"`
}

type AnkaraPosts struct {
	Items     []AnkaraPost `json:"items"`
	Page      int          `json:"page"`
	HasMore   bool         `json:"hasMore"`
	Source    string       `json:"source"`
	UpdatedAt time.Time    `json:"updatedAt"`
}
