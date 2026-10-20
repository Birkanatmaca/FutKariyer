package application

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/clubs/domain"
	footballdomain "futcareer/backend/internal/football/domain"
)

// Ankara is the cached TFF Ankara standings and fixture read of the football module.
type Ankara interface {
	Ankara(ctx context.Context, season, league, group string) (footballdomain.AnkaraTable, error)
}

// TFFInput picks the club's team on the TFF Ankara standings page.
type TFFInput struct {
	Season string `json:"season"`
	League string `json:"league"`
	Group  string `json:"group"`
	Team   string `json:"team"`
}

var tffID = regexp.MustCompile(`^[0-9]{1,10}$`)

// SetTFF links the club to a team that is in the chosen group's standings
// right now, so a typo or a stale pick never reaches the home screen.
func (s *Service) SetTFF(ctx context.Context, userID string, in TFFInput) (domain.Profile, error) {
	in.Season, in.League, in.Group = strings.TrimSpace(in.Season), strings.TrimSpace(in.League), strings.TrimSpace(in.Group)
	in.Team = squash(in.Team)
	fields := auth.ValidationError{}
	if !tffID.MatchString(in.Season) {
		fields["season"] = "Bir sezon seç."
	}
	if !tffID.MatchString(in.League) {
		fields["league"] = "Bir lig seç."
	}
	if in.Group != "" && !tffID.MatchString(in.Group) {
		fields["group"] = "Geçerli bir grup seç."
	}
	if in.Team == "" || len([]rune(in.Team)) > 120 {
		fields["team"] = "Takımını seç."
	}
	if len(fields) > 0 {
		return domain.Profile{}, fields
	}
	if s.ankara == nil {
		return domain.Profile{}, domain.ErrTFFUnavailable
	}
	table, err := s.ankara.Ankara(ctx, in.Season, in.League, in.Group)
	if errors.Is(err, footballdomain.ErrInvalidSelection) {
		return domain.Profile{}, auth.ValidationError{"league": "Geçerli bir lig ve grup seç."}
	}
	if err != nil {
		return domain.Profile{}, fmt.Errorf("%w: %v", domain.ErrTFFUnavailable, err)
	}
	team := ""
	for _, row := range table.Standings {
		if sameTeam(row.Team.Name, in.Team) {
			team = squash(row.Team.Name)
		}
	}
	if team == "" || isBye(team) {
		return domain.Profile{}, auth.ValidationError{"team": "Bu takım seçilen grubun puan tablosunda yok."}
	}
	label := []string{}
	for _, name := range []string{selectedName(table.Seasons), selectedName(table.Leagues), groupName(table.Groups)} {
		if name != "" {
			label = append(label, name)
		}
	}
	return s.repo.SetTFF(ctx, userID, &domain.TFFLink{Season: in.Season, League: in.League, Group: in.Group, Team: team, Label: truncate(strings.Join(label, " · "), 240)})
}

// ClearTFF removes the club's TFF Ankara link.
func (s *Service) ClearTFF(ctx context.Context, userID string) (domain.Profile, error) {
	return s.repo.SetTFF(ctx, userID, nil)
}

// tffLeague reads the club's TFF group. A failed read leaves the league out;
// the club stays marked as linked.
func (s *Service) tffLeague(ctx context.Context, link domain.TFFLink) (domain.LeagueDetail, bool) {
	if s.ankara == nil {
		return domain.LeagueDetail{}, false
	}
	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	table, err := s.ankara.Ankara(ctx, link.Season, link.League, link.Group)
	if err != nil {
		return domain.LeagueDetail{}, false
	}
	return tffDetail(table, link)
}

// tffView is the home card's summary of the club's TFF group.
func tffView(table footballdomain.AnkaraTable, link domain.TFFLink) (domain.LeagueView, bool) {
	detail, ok := tffDetail(table, link)
	return detail.LeagueView, ok
}

// tffDetail turns the federation's table and weekly fixture into the club's
// league: the table, every club match and every week of the group. Bye weeks
// (rakip "BAY") are not matches and are skipped.
func tffDetail(table footballdomain.AnkaraTable, link domain.TFFLink) (domain.LeagueDetail, bool) {
	name := selectedName(table.Leagues)
	if group := groupName(table.Groups); group != "" {
		name += " · " + group
	}
	if strings.Trim(name, " ·") == "" {
		name = link.Label
	}
	view := domain.LeagueView{
		LeagueID: "tff:" + link.Season + ":" + link.League + ":" + link.Group, Source: "tff",
		LeagueName: strings.Trim(name, " ·"), Season: strings.TrimSpace(strings.TrimSuffix(selectedName(table.Seasons), "Sezonu")),
		Status: "active", Standings: []domain.StandingView{},
	}
	found := false
	for _, row := range table.Standings {
		if isBye(row.Team.Name) {
			continue
		}
		own := sameTeam(row.Team.Name, link.Team)
		view.Standings = append(view.Standings, domain.StandingView{Position: row.Rank, TeamName: squash(row.Team.Name), Played: row.Played, Wins: row.Won, Draws: row.Drawn, Losses: row.Lost, GoalDifference: row.GoalDiff, Points: row.Points, Own: own})
		if own {
			found = true
			view.Position, view.Points, view.Played = row.Rank, row.Points, row.Played
			view.Wins, view.Draws, view.Losses, view.GoalDifference = row.Won, row.Drawn, row.Lost, row.GoalDiff
		}
	}
	if !found {
		return domain.LeagueDetail{}, false
	}
	view.TeamCount = len(view.Standings)
	detail := domain.LeagueDetail{LeagueView: view, Matches: []domain.MatchView{}, Weeks: []domain.WeekView{}, CurrentWeek: table.CurrentWeek}
	weeks := slices.Clone(table.Weeks)
	slices.SortStableFunc(weeks, func(a, b footballdomain.AnkaraWeek) int { return a.Number - b.Number })
	for _, week := range weeks {
		fixture := domain.WeekView{Number: week.Number, Matches: []domain.FixtureView{}}
		for i, m := range week.Matches {
			if squash(m.Home) == "" || squash(m.Away) == "" || isBye(m.Home) || isBye(m.Away) {
				continue
			}
			id := fmt.Sprintf("tff-%d-%d", week.Number, i)
			kickoffAt, dateOnly := kickoff(m.Date, m.Time)
			isHome, isAway := sameTeam(m.Home, link.Team), sameTeam(m.Away, link.Team)
			fixture.Matches = append(fixture.Matches, domain.FixtureView{ID: id, HomeName: squash(m.Home), AwayName: squash(m.Away), HomeGoals: m.HomeGoals, AwayGoals: m.AwayGoals, KickoffAt: kickoffAt, DateOnly: dateOnly, Venue: venue(m.Venue), Own: isHome || isAway})
			if !isHome && !isAway {
				continue
			}
			opponent, goalsFor, goalsAgainst := m.Away, m.HomeGoals, m.AwayGoals
			if !isHome {
				opponent, goalsFor, goalsAgainst = m.Home, m.AwayGoals, m.HomeGoals
			}
			item := domain.MatchView{ID: id, Round: week.Number, OpponentName: squash(opponent), IsHome: isHome, KickoffAt: kickoffAt, DateOnly: dateOnly, Venue: venue(m.Venue)}
			if goalsFor != nil && goalsAgainst != nil {
				item = scored(item, goalsFor, goalsAgainst)
			}
			detail.Matches = append(detail.Matches, item)
		}
		if len(fixture.Matches) > 0 {
			detail.Weeks = append(detail.Weeks, fixture)
		}
	}
	return summarize(detail), true
}

// scored adds the score and the result from the club's side.
func scored(item domain.MatchView, goalsFor, goalsAgainst *int) domain.MatchView {
	item.GoalsFor, item.GoalsAgainst = goalsFor, goalsAgainst
	switch {
	case *goalsFor > *goalsAgainst:
		item.Result = "win"
	case *goalsFor == *goalsAgainst:
		item.Result = "draw"
	default:
		item.Result = "loss"
	}
	return item
}

// summarize splits the club's matches into the next three and the last three
// (oldest first) for the home card, and settles the current week when the
// source does not name one: the first week with a club match still to play.
func summarize(detail domain.LeagueDetail) domain.LeagueDetail {
	detail.Upcoming, detail.Recent = []domain.MatchView{}, []domain.MatchView{}
	for _, m := range detail.Matches {
		if m.Result == "" {
			detail.Upcoming = append(detail.Upcoming, m)
		} else {
			detail.Recent = append(detail.Recent, m)
		}
	}
	if detail.CurrentWeek == 0 {
		if len(detail.Upcoming) > 0 {
			detail.CurrentWeek = detail.Upcoming[0].Round
		} else if len(detail.Weeks) > 0 {
			detail.CurrentWeek = detail.Weeks[len(detail.Weeks)-1].Number
		}
	}
	if len(detail.Upcoming) > 3 {
		detail.Upcoming = detail.Upcoming[:3]
	}
	if len(detail.Recent) > 3 {
		detail.Recent = detail.Recent[len(detail.Recent)-3:]
	}
	return detail
}

func squash(s string) string { return strings.Join(strings.Fields(s), " ") }

func sameTeam(a, b string) bool {
	a, b = squash(a), squash(b)
	return a != "" && (a == b || strings.ToUpperSpecial(unicode.TurkishCase, a) == strings.ToUpperSpecial(unicode.TurkishCase, b))
}

func isBye(name string) bool {
	return strings.ToUpperSpecial(unicode.TurkishCase, squash(name)) == "BAY"
}

func selectedName(options []footballdomain.Option) string {
	for _, o := range options {
		if o.Selected {
			return squash(o.Name)
		}
	}
	return ""
}

// groupName is empty for leagues without groups ("Grup yok", id 0).
func groupName(options []footballdomain.Option) string {
	for _, o := range options {
		if o.Selected && o.ID != "0" && o.ID != "" {
			return squash(o.Name)
		}
	}
	return ""
}

func venue(name string) string {
	name = squash(name)
	if strings.ToUpperSpecial(unicode.TurkishCase, name) == "SAHA BELİRSİZ" {
		return ""
	}
	return name
}

func truncate(s string, limit int) string {
	if r := []rune(s); len(r) > limit {
		return string(r[:limit])
	}
	return s
}

// Türkiye has no daylight saving time; a fixed zone needs no tzdata.
var trt = time.FixedZone("TRT", 3*60*60)

var trMonths = map[string]time.Month{
	"ocak": time.January, "şubat": time.February, "mart": time.March, "nisan": time.April,
	"mayıs": time.May, "haziran": time.June, "temmuz": time.July, "ağustos": time.August,
	"eylül": time.September, "ekim": time.October, "kasım": time.November, "aralık": time.December,
}

var (
	numericDate = regexp.MustCompile(`^([0-9]{1,2})[./]([0-9]{1,2})[./]([0-9]{4})$`)
	clockTime   = regexp.MustCompile(`^([01]?[0-9]|2[0-3])[:.]([0-5][0-9])$`)
)

// kickoff reads the page's "19 Eylül 2026 Cumartesi" (or "19.09.2026") and
// "12:00" as Türkiye time. Without a usable time (or "00:00", the page's
// placeholder) only the day is known; "TARİHİ BELİRLENMEDİ" gives nil.
func kickoff(date, clock string) (*time.Time, bool) {
	fields := strings.Fields(date)
	day, month, year := 0, time.Month(0), 0
	if len(fields) >= 3 {
		day, _ = strconv.Atoi(fields[0])
		month = trMonths[strings.ToLowerSpecial(unicode.TurkishCase, fields[1])]
		year, _ = strconv.Atoi(fields[2])
	} else if len(fields) >= 1 {
		if m := numericDate.FindStringSubmatch(fields[0]); m != nil {
			day, _ = strconv.Atoi(m[1])
			n, _ := strconv.Atoi(m[2])
			month = time.Month(n)
			year, _ = strconv.Atoi(m[3])
		}
	}
	if day < 1 || month < time.January || month > time.December || year < 2000 {
		return nil, false
	}
	at := time.Date(year, month, day, 0, 0, 0, 0, trt)
	if at.Day() != day {
		return nil, false
	}
	if m := clockTime.FindStringSubmatch(strings.TrimSpace(clock)); m != nil {
		hour, _ := strconv.Atoi(m[1])
		minute, _ := strconv.Atoi(m[2])
		if hour != 0 || minute != 0 {
			at = at.Add(time.Duration(hour)*time.Hour + time.Duration(minute)*time.Minute).UTC()
			return &at, false
		}
	}
	at = at.UTC()
	return &at, true
}
