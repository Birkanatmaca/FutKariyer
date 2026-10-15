package ankara

import (
	"context"
	"fmt"
	"io"
	"regexp"

	"futcareer/backend/internal/football/domain"
	"golang.org/x/net/html"
)

var clock = regexp.MustCompile(`^\d{1,2}[:.]\d{2}$`)

// Bulletin loads the weekly programme of all leagues.
func (c *Client) Bulletin(ctx context.Context) (domain.AnkaraBulletin, error) {
	body, err := c.get(ctx, c.base+"/home/onaylibulten", "text/html")
	if err != nil {
		return domain.AnkaraBulletin{}, err
	}
	defer body.Close()
	return ParseBulletin(io.LimitReader(body, 8<<20))
}

// ParseBulletin reads the single bulletin table: a <th> row starts a day, a
// row holding an <h5> starts a venue, and four-cell rows are matches
// (time, home, away, league).
func ParseBulletin(r io.Reader) (domain.AnkaraBulletin, error) {
	doc, err := html.Parse(r)
	if err != nil {
		return domain.AnkaraBulletin{}, fmt.Errorf("%w: parse: %v", domain.ErrUpstream, err)
	}
	out := domain.AnkaraBulletin{Days: []domain.BulletinDay{}, Leagues: []string{}, Source: SourceLabel}
	seen := map[string]bool{}
	var day *domain.BulletinDay
	var venue *domain.BulletinVenue
	for _, row := range find(doc, func(n *html.Node) bool { return n.Data == "tr" }) {
		if th := find(row, func(n *html.Node) bool { return n.Data == "th" }); len(th) > 0 {
			out.Days = append(out.Days, domain.BulletinDay{Date: text(th[0]), Venues: []domain.BulletinVenue{}})
			day, venue = &out.Days[len(out.Days)-1], nil
			continue
		}
		if day == nil {
			continue
		}
		if h5 := find(row, func(n *html.Node) bool { return n.Data == "h5" }); len(h5) > 0 {
			day.Venues = append(day.Venues, domain.BulletinVenue{Name: text(h5[0]), Matches: []domain.BulletinMatch{}})
			venue = &day.Venues[len(day.Venues)-1]
			continue
		}
		cells := find(row, func(n *html.Node) bool { return n.Data == "td" })
		if venue == nil || len(cells) < 4 || !clock.MatchString(text(cells[0])) {
			continue
		}
		m := domain.BulletinMatch{Time: text(cells[0]), Home: text(cells[1]), Away: text(cells[2]), League: text(cells[3])}
		venue.Matches = append(venue.Matches, m)
		if m.League != "" && !seen[m.League] {
			seen[m.League] = true
			out.Leagues = append(out.Leagues, m.League)
		}
	}
	return out, nil
}
