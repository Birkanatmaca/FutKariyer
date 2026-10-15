// Package provider reads ESPN's public site API for the major leagues. It needs
// no key. It is not an official, documented API: the product owner accepted
// that it may change or stop without notice (see PROJECT.md, Lig verileri), so
// every response is parsed defensively and failures surface as ErrUpstream.
package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"futcareer/backend/internal/football/domain"
)

const DefaultBaseURL = "https://site.api.espn.com"

type Client struct {
	base string
	http *http.Client
}

func New(base string) *Client {
	if base == "" {
		base = DefaultBaseURL
	}
	return &Client{base: strings.TrimRight(base, "/"), http: &http.Client{Timeout: 10 * time.Second}}
}

func get[T any](ctx context.Context, c *Client, path string) (T, error) {
	var out T
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.base+path, nil)
	if err != nil {
		return out, err
	}
	req.Header.Set("Accept", "application/json")
	res, err := c.http.Do(req)
	if err != nil {
		return out, fmt.Errorf("%w: %v", domain.ErrUpstream, err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return out, fmt.Errorf("%w: %s status %d", domain.ErrUpstream, path, res.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if err != nil {
		return out, fmt.Errorf("%w: %v", domain.ErrUpstream, err)
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return out, fmt.Errorf("%w: decode %s: %v", domain.ErrUpstream, path, err)
	}
	return out, nil
}

type logo struct {
	Href string `json:"href"`
}

func firstLogo(logos []logo) string {
	if len(logos) == 0 {
		return ""
	}
	return logos[0].Href
}

type stat struct {
	Name  string  `json:"name"`
	Value float64 `json:"value"`
}

// Standings returns the league table in ESPN's order and the season label.
func (c *Client) Standings(ctx context.Context, code string) (string, []domain.StandingRow, error) {
	type entry struct {
		Team struct {
			DisplayName string `json:"displayName"`
			Logos       []logo `json:"logos"`
		} `json:"team"`
		Note *struct {
			Description string `json:"description"`
		} `json:"note"`
		Stats []stat `json:"stats"`
	}
	type response struct {
		Children []struct {
			Name      string `json:"name"`
			Standings struct {
				SeasonDisplayName string  `json:"seasonDisplayName"`
				Entries           []entry `json:"entries"`
			} `json:"standings"`
		} `json:"children"`
	}
	r, err := get[response](ctx, c, "/apis/v2/sports/soccer/"+code+"/standings")
	if err != nil {
		return "", nil, err
	}
	if len(r.Children) == 0 {
		return "", nil, fmt.Errorf("%w: no standings for %s", domain.ErrUpstream, code)
	}
	season := seasonLabel(r.Children[0].Standings.SeasonDisplayName)
	rows := []domain.StandingRow{}
	for _, child := range r.Children {
		group := ""
		if len(r.Children) > 1 {
			group = child.Name
		}
		for i, e := range child.Standings.Entries {
			v := map[string]int{}
			for _, s := range e.Stats {
				v[s.Name] = int(s.Value)
			}
			row := domain.StandingRow{
				Rank: v["rank"], Team: domain.Team{Name: e.Team.DisplayName, LogoURL: firstLogo(e.Team.Logos)},
				Played: v["gamesPlayed"], Won: v["wins"], Drawn: v["ties"], Lost: v["losses"],
				GoalsFor: v["pointsFor"], GoalsAgainst: v["pointsAgainst"], GoalDiff: v["pointDifferential"], Points: v["points"], Group: group,
			}
			if row.Rank == 0 {
				row.Rank = i + 1
			}
			if e.Note != nil {
				row.Description = e.Note.Description
			}
			rows = append(rows, row)
		}
	}
	return season, rows, nil
}

var seasonPattern = regexp.MustCompile(`\d{4}-\d{2}`)

// seasonLabel turns "2026-27 English Premier League" into "2026-27".
func seasonLabel(display string) string {
	if m := seasonPattern.FindString(display); m != "" {
		return m
	}
	return strings.TrimSpace(display)
}

type event struct {
	ID     string `json:"id"`
	Date   string `json:"date"`
	Status struct {
		DisplayClock string `json:"displayClock"`
		Type         struct {
			State       string `json:"state"`
			Completed   bool   `json:"completed"`
			ShortDetail string `json:"shortDetail"`
		} `json:"type"`
	} `json:"status"`
	Competitions []struct {
		Competitors []struct {
			HomeAway string `json:"homeAway"`
			Score    string `json:"score"`
			Team     struct {
				DisplayName string `json:"displayName"`
				Logo        string `json:"logo"`
			} `json:"team"`
		} `json:"competitors"`
	} `json:"competitions"`
}

// Calendar is a list of match days ("2026-10-04T07:00Z") for domestic leagues
// and a list of season stages with dated rounds for the UEFA cups, so it is
// decoded lazily by MatchDays.
type scoreboard struct {
	Leagues []struct {
		Calendar json.RawMessage `json:"calendar"`
	} `json:"leagues"`
	Events []event `json:"events"`
}

var minutePattern = regexp.MustCompile(`^(\d+)`)

// parseTime accepts ESPN's minute-precision "2026-10-13T16:00Z" as well as RFC 3339.
func parseTime(v string) (time.Time, bool) {
	for _, layout := range []string{"2006-01-02T15:04Z", time.RFC3339} {
		if t, err := time.Parse(layout, v); err == nil {
			return t.UTC(), true
		}
	}
	return time.Time{}, false
}

// normalise maps ESPN's pre/in/post states to live, finished, scheduled or other.
func (e event) domain() (domain.Fixture, bool) {
	if len(e.Competitions) == 0 {
		return domain.Fixture{}, false
	}
	id, _ := strconv.Atoi(e.ID)
	kickoff, ok := parseTime(e.Date)
	if !ok {
		return domain.Fixture{}, false
	}
	f := domain.Fixture{ID: id, Kickoff: kickoff, StatusLabel: e.Status.Type.ShortDetail}
	switch {
	case e.Status.Type.State == "in":
		f.Status = "live"
		if m := minutePattern.FindString(e.Status.DisplayClock); m != "" {
			n, _ := strconv.Atoi(m)
			f.Elapsed = &n
		}
	case e.Status.Type.State == "post" && e.Status.Type.Completed:
		f.Status = "finished"
	case e.Status.Type.State == "pre":
		f.Status = "scheduled"
	default:
		f.Status = "other"
	}
	for _, t := range e.Competitions[0].Competitors {
		team := domain.Team{Name: t.Team.DisplayName, LogoURL: t.Team.Logo}
		var goals *int
		if f.Status != "scheduled" && t.Score != "" {
			if n, err := strconv.Atoi(t.Score); err == nil {
				goals = &n
			}
		}
		if t.HomeAway == "home" {
			f.Home, f.HomeGoals = team, goals
		} else {
			f.Away, f.AwayGoals = team, goals
		}
	}
	return f, f.Home.Name != "" && f.Away.Name != ""
}

// scoreboard reads one day (YYYY-MM-DD), one month (YYYY-MM) or, without a
// date, the current scoreboard. ESPN rejects date ranges but accepts a month.
func (c *Client) scoreboard(ctx context.Context, code, date string) (scoreboard, error) {
	path := "/apis/site/v2/sports/soccer/" + code + "/scoreboard"
	if date != "" {
		path += "?dates=" + strings.ReplaceAll(date, "-", "")
		if len(date) == len("2006-01") {
			path += "&limit=200"
		}
	}
	return get[scoreboard](ctx, c, path)
}

// FixturesOn returns a league's matches on one day (YYYY-MM-DD).
func (c *Client) FixturesOn(ctx context.Context, code, day string) ([]domain.Fixture, error) {
	return c.fixtures(ctx, code, day)
}

// FixturesInMonth returns a competition's matches in one month (YYYY-MM).
func (c *Client) FixturesInMonth(ctx context.Context, code, month string) ([]domain.Fixture, error) {
	return c.fixtures(ctx, code, month)
}

func (c *Client) fixtures(ctx context.Context, code, date string) ([]domain.Fixture, error) {
	sb, err := c.scoreboard(ctx, code, date)
	if err != nil {
		return nil, err
	}
	out := []domain.Fixture{}
	for _, e := range sb.Events {
		if f, ok := e.domain(); ok {
			out = append(out, f)
		}
	}
	return out, nil
}

// Round is one dated stage of a cup calendar, e.g. "League Phase".
type Round struct {
	Label string
	Start time.Time
	End   time.Time
}

// Calendar is a competition's season calendar: match days for the domestic
// leagues, dated rounds for the UEFA cups.
type Calendar struct {
	Days   []string
	Rounds []Round
}

// MatchDays returns the season calendar. Days are YYYY-MM-DD.
func (c *Client) MatchDays(ctx context.Context, code string) (Calendar, error) {
	sb, err := c.scoreboard(ctx, code, "")
	if err != nil {
		return Calendar{}, err
	}
	if len(sb.Leagues) == 0 {
		return Calendar{Days: []string{}}, nil
	}
	return parseCalendar(sb.Leagues[0].Calendar)
}

func parseCalendar(raw json.RawMessage) (Calendar, error) {
	out := Calendar{Days: []string{}}
	if len(raw) == 0 || string(raw) == "null" {
		return out, nil
	}
	var days []string
	if err := json.Unmarshal(raw, &days); err == nil {
		for _, d := range days {
			if t, ok := parseTime(d); ok {
				out.Days = append(out.Days, t.Format(time.DateOnly))
			}
		}
		return out, nil
	}
	type entry struct {
		Label     string `json:"label"`
		StartDate string `json:"startDate"`
		EndDate   string `json:"endDate"`
	}
	var stages []struct {
		entry
		Entries []entry `json:"entries"`
	}
	if err := json.Unmarshal(raw, &stages); err != nil {
		return out, fmt.Errorf("%w: calendar: %v", domain.ErrUpstream, err)
	}
	for _, stage := range stages {
		entries := stage.Entries
		if len(entries) == 0 {
			entries = []entry{stage.entry}
		}
		for _, e := range entries {
			start, okStart := parseTime(e.StartDate)
			end, okEnd := parseTime(e.EndDate)
			if okStart && okEnd {
				out.Rounds = append(out.Rounds, Round{Label: e.Label, Start: start, End: end})
			}
		}
	}
	return out, nil
}

var matchesPattern = regexp.MustCompile(`Matches:\s*(\d+)`)

// Leaders returns the top scorers and assist leaders.
func (c *Client) Leaders(ctx context.Context, code string, limit int) (string, []domain.PlayerStat, []domain.PlayerStat, error) {
	type leader struct {
		Value        float64 `json:"value"`
		DisplayValue string  `json:"displayValue"`
		Athlete      struct {
			DisplayName string `json:"displayName"`
			Headshot    *logo  `json:"headshot"`
			Team        *struct {
				DisplayName string `json:"displayName"`
				Logos       []logo `json:"logos"`
			} `json:"team"`
		} `json:"athlete"`
	}
	type response struct {
		Season struct {
			DisplayName string `json:"displayName"`
		} `json:"season"`
		Stats []struct {
			Name    string   `json:"name"`
			Leaders []leader `json:"leaders"`
		} `json:"stats"`
	}
	r, err := get[response](ctx, c, "/apis/site/v2/sports/soccer/"+code+"/statistics")
	if err != nil {
		return "", nil, nil, err
	}
	convert := func(list []leader) []domain.PlayerStat {
		out := []domain.PlayerStat{}
		for i, l := range list {
			if i >= limit {
				break
			}
			p := domain.PlayerStat{Rank: i + 1, Name: l.Athlete.DisplayName, Value: int(l.Value)}
			if l.Athlete.Headshot != nil {
				p.PhotoURL = l.Athlete.Headshot.Href
			}
			if l.Athlete.Team != nil {
				p.Team = domain.Team{Name: l.Athlete.Team.DisplayName, LogoURL: firstLogo(l.Athlete.Team.Logos)}
			}
			if m := matchesPattern.FindStringSubmatch(l.DisplayValue); m != nil {
				p.Appearances, _ = strconv.Atoi(m[1])
			}
			out = append(out, p)
		}
		return out
	}
	var goals, assists []domain.PlayerStat
	for _, s := range r.Stats {
		switch s.Name {
		case "goalsLeaders":
			goals = convert(s.Leaders)
		case "assistsLeaders":
			assists = convert(s.Leaders)
		}
	}
	if goals == nil {
		goals = []domain.PlayerStat{}
	}
	if assists == nil {
		assists = []domain.PlayerStat{}
	}
	return seasonLabel(r.Season.DisplayName), goals, assists, nil
}
