// Package ankara reads the public TFF Ankara standings and fixture page
// (sistem.tffankara.org/home/puanfikstur). The page is server-rendered: season,
// league and group are query parameters, and the response contains the option
// lists, the standings table and every week's fixtures.
package ankara

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"futcareer/backend/internal/football/domain"
	"golang.org/x/net/html"
)

const DefaultBaseURL = "https://sistem.tffankara.org"

// SourceLabel is shown in the app next to the data.
const SourceLabel = "TFF Ankara İl Temsilciliği"

var numeric = regexp.MustCompile(`^[0-9]{1,10}$`)

// DefaultNewsBaseURL is the federation's WordPress site with announcements.
const DefaultNewsBaseURL = "https://tffankara.org"

type Client struct {
	base string
	news string
	http *http.Client
}

func New(base string) *Client {
	if base == "" {
		base = DefaultBaseURL
	}
	return &Client{base: strings.TrimRight(base, "/"), news: DefaultNewsBaseURL, http: &http.Client{Timeout: 15 * time.Second}}
}

// WithNews overrides the announcements site; tests point it at a stub.
func (c *Client) WithNews(base string) *Client {
	if base != "" {
		c.news = strings.TrimRight(base, "/")
	}
	return c
}

// get fetches a page from one of the TFF Ankara sites.
func (c *Client) get(ctx context.Context, target, accept string) (io.ReadCloser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "FutCareer/1.0 (+lig verisi; önbellekli)")
	req.Header.Set("Accept", accept)
	res, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", domain.ErrUpstream, err)
	}
	if res.StatusCode != http.StatusOK {
		res.Body.Close()
		return nil, fmt.Errorf("%w: status %d", domain.ErrUpstream, res.StatusCode)
	}
	return res.Body, nil
}

// Fetch loads one season/league/group selection; empty values use the site's defaults.
func (c *Client) Fetch(ctx context.Context, season, league, group string) (domain.AnkaraTable, error) {
	query := url.Values{}
	for key, value := range map[string]string{"sezon": season, "lig": league, "grup": group} {
		if value == "" {
			continue
		}
		if !numeric.MatchString(value) {
			return domain.AnkaraTable{}, domain.ErrInvalidSelection
		}
		query.Set(key, value)
	}
	target := c.base + "/home/puanfikstur"
	if len(query) > 0 {
		target += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return domain.AnkaraTable{}, err
	}
	req.Header.Set("User-Agent", "FutCareer/1.0 (+lig verisi; önbellekli)")
	req.Header.Set("Accept", "text/html")
	res, err := c.http.Do(req)
	if err != nil {
		return domain.AnkaraTable{}, fmt.Errorf("%w: %v", domain.ErrUpstream, err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return domain.AnkaraTable{}, fmt.Errorf("%w: status %d", domain.ErrUpstream, res.StatusCode)
	}
	return Parse(io.LimitReader(res.Body, 8<<20), c.base)
}

// Parse extracts options, standings and fixtures from the page.
func Parse(r io.Reader, base string) (domain.AnkaraTable, error) {
	doc, err := html.Parse(r)
	if err != nil {
		return domain.AnkaraTable{}, fmt.Errorf("%w: parse: %v", domain.ErrUpstream, err)
	}
	out := domain.AnkaraTable{Seasons: []domain.Option{}, Leagues: []domain.Option{}, Groups: []domain.Option{}, Standings: []domain.StandingRow{}, Weeks: []domain.AnkaraWeek{}, Source: SourceLabel}
	walk(doc, func(n *html.Node) bool {
		switch {
		case n.Type == html.ElementNode && n.Data == "select":
			switch attr(n, "name") {
			case "sezon":
				out.Seasons = options(n)
			case "lig":
				out.Leagues = options(n)
			case "grup":
				out.Groups = options(n)
			}
			return false
		case n.Type == html.ElementNode && n.Data == "table" && hasClass(n, "table-standings"):
			out.Standings = standings(n, base)
			return false
		case n.Type == html.ElementNode && strings.HasPrefix(attr(n, "id"), "machafta-"):
			if week, err := strconv.Atoi(strings.TrimPrefix(attr(n, "id"), "machafta-")); err == nil {
				out.Weeks = append(out.Weeks, domain.AnkaraWeek{Number: week, Matches: matches(n)})
			}
			return false
		case n.Type == html.ElementNode && n.Data == "button" && hasClass(n, "btn-danger") && attr(n, "data-hafta") != "":
			out.CurrentWeek, _ = strconv.Atoi(attr(n, "data-hafta"))
		}
		return true
	})
	if len(out.Seasons) == 0 && len(out.Standings) == 0 {
		return out, fmt.Errorf("%w: page layout not recognised", domain.ErrUpstream)
	}
	if out.CurrentWeek == 0 {
		out.CurrentWeek = currentWeek(out.Weeks)
	}
	return out, nil
}

// currentWeek falls back to the last week with a played match, or the first week.
func currentWeek(weeks []domain.AnkaraWeek) int {
	current := 0
	for _, w := range weeks {
		for _, m := range w.Matches {
			if m.HomeGoals != nil {
				current = w.Number
			}
		}
	}
	if current == 0 && len(weeks) > 0 {
		current = weeks[0].Number
	}
	return current
}

// walk visits nodes depth-first; visit returns false to skip a node's children.
func walk(n *html.Node, visit func(*html.Node) bool) {
	if !visit(n) {
		return
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		walk(c, visit)
	}
}

func attr(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if a.Key == key {
			return a.Val
		}
	}
	return ""
}

func hasAttr(n *html.Node, key string) bool {
	for _, a := range n.Attr {
		if a.Key == key {
			return true
		}
	}
	return false
}

func hasClass(n *html.Node, class string) bool {
	for _, c := range strings.Fields(attr(n, "class")) {
		if c == class {
			return true
		}
	}
	return false
}

func text(n *html.Node) string {
	var b strings.Builder
	walk(n, func(c *html.Node) bool {
		if c.Type == html.TextNode {
			b.WriteString(c.Data)
			b.WriteByte(' ')
		}
		return true
	})
	return strings.Join(strings.Fields(b.String()), " ")
}

func find(n *html.Node, match func(*html.Node) bool) []*html.Node {
	var out []*html.Node
	walk(n, func(c *html.Node) bool {
		if c != n && c.Type == html.ElementNode && match(c) {
			out = append(out, c)
		}
		return true
	})
	return out
}

func byClass(class string) func(*html.Node) bool {
	return func(n *html.Node) bool { return hasClass(n, class) }
}

func options(sel *html.Node) []domain.Option {
	out := []domain.Option{}
	selected := false
	for _, o := range find(sel, func(n *html.Node) bool { return n.Data == "option" }) {
		opt := domain.Option{ID: attr(o, "value"), Name: text(o), Selected: hasAttr(o, "selected")}
		selected = selected || opt.Selected
		out = append(out, opt)
	}
	// Without an explicit selection the browser shows the first option.
	if !selected && len(out) > 0 {
		out[0].Selected = true
	}
	return out
}

func number(s string) int {
	n, _ := strconv.Atoi(strings.TrimSpace(s))
	return n
}

func logo(n *html.Node, base string) string {
	imgs := find(n, func(c *html.Node) bool { return c.Data == "img" })
	if len(imgs) == 0 {
		return ""
	}
	src := attr(imgs[0], "src")
	if src == "" || strings.Contains(src, "futbol.jpg") {
		return ""
	}
	if strings.HasPrefix(src, "/") {
		return base + src
	}
	if strings.HasPrefix(src, "https://") {
		return src
	}
	return ""
}

// standings reads rows: #, team, O, G, B, M, A, Y, AV, P.
func standings(table *html.Node, base string) []domain.StandingRow {
	out := []domain.StandingRow{}
	for _, tr := range find(table, func(n *html.Node) bool { return n.Data == "tr" }) {
		cells := find(tr, func(n *html.Node) bool { return n.Data == "td" })
		if len(cells) < 10 {
			continue
		}
		out = append(out, domain.StandingRow{
			Rank: number(text(cells[0])), Team: domain.Team{Name: text(cells[1]), LogoURL: logo(cells[1], base)},
			Played: number(text(cells[2])), Won: number(text(cells[3])), Drawn: number(text(cells[4])), Lost: number(text(cells[5])),
			GoalsFor: number(text(cells[6])), GoalsAgainst: number(text(cells[7])), GoalDiff: number(text(cells[8])), Points: number(text(cells[9])),
		})
	}
	return out
}

func goals(s string) *int {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return nil
	}
	return &n
}

func matches(week *html.Node) []domain.AnkaraMatch {
	out := []domain.AnkaraMatch{}
	for _, li := range find(week, byClass("widget-results__item")) {
		var m domain.AnkaraMatch
		if titles := find(li, byClass("widget-results__title")); len(titles) > 0 {
			m.Date = text(titles[0])
		}
		names := find(li, byClass("widget-results__team-name"))
		if len(names) < 2 {
			continue
		}
		m.Home, m.Away = text(names[0]), text(names[1])
		if scores := find(li, byClass("widget-results__score")); len(scores) > 0 {
			var values []string
			for _, span := range find(scores[0], func(n *html.Node) bool {
				return n.Data == "span" && (hasClass(n, "widget-results__score-winner") || hasClass(n, "widget-results__score-loser"))
			}) {
				values = append(values, text(span))
			}
			if len(values) == 2 {
				m.HomeGoals, m.AwayGoals = goals(values[0]), goals(values[1])
			}
			if status := find(scores[0], byClass("widget-results__status")); len(status) > 0 {
				m.Status = text(status[0])
			}
		}
		if venue := find(li, byClass("widget-results__venue")); len(venue) > 0 {
			spans := find(venue[0], func(n *html.Node) bool { return n.Data == "span" })
			if len(spans) > 0 {
				m.Venue = text(spans[0])
			}
			if len(spans) > 1 {
				m.Time = strings.TrimSpace(strings.TrimPrefix(text(spans[1]), "-"))
			}
		}
		out = append(out, m)
	}
	return out
}
