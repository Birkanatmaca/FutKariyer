package application

import (
	"context"
	"sort"
	"strconv"
	"time"

	"futcareer/backend/internal/football/ankara"
	"futcareer/backend/internal/football/domain"
	"futcareer/backend/internal/football/provider"
)

// Cache lifetimes keep data fresh while sending only a handful of requests to
// ESPN and the TFF Ankara site, however many people use the app.
const (
	standingsTTL = 10 * time.Minute
	liveTTL      = 30 * time.Second
	matchDaysTTL = 6 * time.Hour
	dayTTL       = 10 * time.Minute
	statsTTL     = time.Hour
	ankaraTTL    = 15 * time.Minute
	postsTTL     = 30 * time.Minute
	resultDays   = 3
	resultMonths = 2
	resultLimit  = 15
	leaderLimit  = 10
)

type Service struct {
	provider *provider.Client
	ankara   *ankara.Client
	cache    *cache
	now      func() time.Time
}

func New(p *provider.Client, a *ankara.Client) *Service {
	return &Service{provider: p, ankara: a, cache: newCache(), now: time.Now}
}

// SetClock replaces the clock; tests use it to pin "today".
func (s *Service) SetClock(now func() time.Time) { s.now = now }

type Catalog struct {
	// Competitions are the six domestic leagues; older app builds only know these.
	Competitions []domain.Competition `json:"competitions"`
	// Cups are the UEFA club competitions (14 Oct 2026).
	Cups []domain.Competition `json:"cups"`
	// ProviderConfigured stays in the response for older app builds; ESPN needs no key.
	ProviderConfigured bool   `json:"providerConfigured"`
	Source             string `json:"source"`
	Ankara             struct {
		Name   string `json:"name"`
		Source string `json:"source"`
	} `json:"ankara"`
}

func (s *Service) Catalog() Catalog {
	c := Catalog{Competitions: domain.Competitions, Cups: domain.Cups, ProviderConfigured: true, Source: "ESPN"}
	c.Ankara.Name = "TFF Ankara Amatör Ligleri"
	c.Ankara.Source = ankara.SourceLabel
	return c
}

func cached[T any](s *Service, key string, ttl time.Duration, load func() (T, error)) (T, error) {
	v, err := s.cache.get(key, ttl, func() (any, error) { return load() })
	if err != nil {
		var zero T
		return zero, err
	}
	return v.(T), nil
}

func competition(slug string) (domain.Competition, error) {
	c, ok := domain.CompetitionBySlug(slug)
	if !ok {
		return c, domain.ErrUnknownCompetition
	}
	return c, nil
}

// today is the calendar day in Türkiye, which is how the app groups matches.
func (s *Service) today() string {
	return s.now().In(trt).Format(time.DateOnly)
}

var trt = time.FixedZone("TRT", 3*60*60)

func (s *Service) Standings(ctx context.Context, slug string) (domain.Standings, error) {
	c, err := competition(slug)
	if err != nil {
		return domain.Standings{}, err
	}
	return cached(s, "standings:"+slug, standingsTTL, func() (domain.Standings, error) {
		season, rows, err := s.provider.Standings(ctx, c.Code)
		return domain.Standings{Season: season, Rows: rows, UpdatedAt: s.now().UTC()}, err
	})
}

func (s *Service) day(ctx context.Context, c domain.Competition, day string, ttl time.Duration) ([]domain.Fixture, error) {
	return cached(s, "day:"+c.Slug+":"+day, ttl, func() ([]domain.Fixture, error) {
		return s.provider.FixturesOn(ctx, c.Code, day)
	})
}

// Live returns today's matches with their live state, refreshed every 30 seconds.
func (s *Service) Live(ctx context.Context, slug string) (domain.Live, error) {
	c, err := competition(slug)
	if err != nil {
		return domain.Live{}, err
	}
	today := s.today()
	items, err := s.day(ctx, c, today, liveTTL)
	if err != nil {
		return domain.Live{}, err
	}
	sort.SliceStable(items, func(i, j int) bool { return items[i].Kickoff.Before(items[j].Kickoff) })
	return domain.Live{Date: today, Items: items, UpdatedAt: s.now().UTC()}, nil
}

// Results returns recent finished matches, newest first: from the last few
// match days of a league, or from the last months of a cup, whose calendar
// lists rounds instead of match days.
func (s *Service) Results(ctx context.Context, slug string) (domain.Results, error) {
	c, err := competition(slug)
	if err != nil {
		return domain.Results{}, err
	}
	cal, err := cached(s, "matchdays:"+slug, matchDaysTTL, func() (provider.Calendar, error) { return s.provider.MatchDays(ctx, c.Code) })
	if err != nil {
		return domain.Results{}, err
	}
	var fixtures []domain.Fixture
	if len(cal.Days) > 0 {
		fixtures, err = s.recentDays(ctx, c, cal.Days)
	} else {
		fixtures, err = s.recentMonths(ctx, c, cal.Rounds)
	}
	if err != nil {
		return domain.Results{}, err
	}
	finished := []domain.Fixture{}
	for _, f := range fixtures {
		if f.Status == "finished" {
			finished = append(finished, f)
		}
	}
	sort.SliceStable(finished, func(i, j int) bool { return finished[i].Kickoff.After(finished[j].Kickoff) })
	if len(finished) > resultLimit {
		finished = finished[:resultLimit]
	}
	season := ""
	if st, err := s.Standings(ctx, slug); err == nil {
		season = st.Season
	}
	return domain.Results{Season: season, Items: finished, UpdatedAt: s.now().UTC()}, nil
}

func (s *Service) recentDays(ctx context.Context, c domain.Competition, days []string) ([]domain.Fixture, error) {
	today := s.today()
	past := []string{}
	for _, d := range days {
		if d <= today {
			past = append(past, d)
		}
	}
	if len(past) > resultDays {
		past = past[len(past)-resultDays:]
	}
	out := []domain.Fixture{}
	for _, d := range past {
		ttl := dayTTL
		if d == today {
			ttl = liveTTL
		}
		items, err := s.day(ctx, c, d, ttl)
		if err != nil {
			return nil, err
		}
		out = append(out, items...)
	}
	return out, nil
}

// recentMonths reads this month and the previous one (Türkiye time), skipping
// months outside every round of the calendar, e.g. the summer break.
func (s *Service) recentMonths(ctx context.Context, c domain.Competition, rounds []provider.Round) ([]domain.Fixture, error) {
	now := s.now().In(trt)
	current := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, trt)
	out := []domain.Fixture{}
	for i := 0; i < resultMonths; i++ {
		start := current.AddDate(0, -i, 0)
		if !inRounds(rounds, start, start.AddDate(0, 1, 0)) {
			continue
		}
		month := start.Format("2006-01")
		ttl := dayTTL
		if i == 0 {
			ttl = liveTTL
		}
		items, err := cached(s, "month:"+c.Slug+":"+month, ttl, func() ([]domain.Fixture, error) {
			return s.provider.FixturesInMonth(ctx, c.Code, month)
		})
		if err != nil {
			return nil, err
		}
		out = append(out, items...)
	}
	return out, nil
}

// inRounds reports whether [from, to) overlaps a round; without rounds every month counts.
func inRounds(rounds []provider.Round, from, to time.Time) bool {
	if len(rounds) == 0 {
		return true
	}
	for _, r := range rounds {
		if r.Start.Before(to) && r.End.After(from) {
			return true
		}
	}
	return false
}

func (s *Service) Stats(ctx context.Context, slug string) (domain.Stats, error) {
	c, err := competition(slug)
	if err != nil {
		return domain.Stats{}, err
	}
	return cached(s, "stats:"+slug, statsTTL, func() (domain.Stats, error) {
		season, goals, assists, err := s.provider.Leaders(ctx, c.Code, leaderLimit)
		return domain.Stats{Season: season, TopScorers: goals, TopAssists: assists, UpdatedAt: s.now().UTC()}, err
	})
}

// Ankara returns one TFF Ankara season/league/group selection.
func (s *Service) Ankara(ctx context.Context, season, league, group string) (domain.AnkaraTable, error) {
	for _, v := range []string{season, league, group} {
		if v != "" {
			if _, err := strconv.Atoi(v); err != nil || len(v) > 10 {
				return domain.AnkaraTable{}, domain.ErrInvalidSelection
			}
		}
	}
	return cached(s, "ankara:"+season+":"+league+":"+group, ankaraTTL, func() (domain.AnkaraTable, error) {
		t, err := s.ankara.Fetch(ctx, season, league, group)
		t.UpdatedAt = s.now().UTC()
		return t, err
	})
}

// AnkaraBulletin returns this week's programme of every TFF Ankara league.
func (s *Service) AnkaraBulletin(ctx context.Context) (domain.AnkaraBulletin, error) {
	return cached(s, "ankara-bulletin", ankaraTTL, func() (domain.AnkaraBulletin, error) {
		b, err := s.ankara.Bulletin(ctx)
		b.UpdatedAt = s.now().UTC()
		return b, err
	})
}

// AnkaraPosts returns one page of federation announcements.
func (s *Service) AnkaraPosts(ctx context.Context, page int) (domain.AnkaraPosts, error) {
	return cached(s, "ankara-posts:"+strconv.Itoa(page), postsTTL, func() (domain.AnkaraPosts, error) {
		p, err := s.ankara.Posts(ctx, page)
		p.UpdatedAt = s.now().UTC()
		return p, err
	})
}
