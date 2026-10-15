package application_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"futcareer/backend/internal/football/ankara"
	"futcareer/backend/internal/football/application"
	"futcareer/backend/internal/football/domain"
	"futcareer/backend/internal/football/provider"
)

// espnStub mimics the ESPN site API responses the service reads.
func espnStub(t *testing.T, calls *int32) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(calls, 1)
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/apis/v2/sports/soccer/tur.1/standings":
			w.Write([]byte(`{"children":[{"name":"2026-27 Turkish Super Lig","standings":{"seasonDisplayName":"2026-27 Turkish Super Lig","entries":[
				{"team":{"displayName":"Galatasaray","logos":[{"href":"g.png"}]},"note":{"description":"Champions League"},"stats":[{"name":"rank","value":1},{"name":"gamesPlayed","value":7},{"name":"wins","value":5},{"name":"ties","value":1},{"name":"losses","value":1},{"name":"pointsFor","value":16},{"name":"pointsAgainst","value":11},{"name":"pointDifferential","value":5},{"name":"points","value":16}]}]}}]}`))
		case r.URL.Path == "/apis/site/v2/sports/soccer/tur.1/scoreboard" && r.URL.Query().Get("dates") == "":
			w.Write([]byte(`{"leagues":[{"calendar":["2026-10-04T07:00Z","2026-10-11T07:00Z","2026-10-13T07:00Z","2026-10-20T07:00Z"]}],"events":[]}`))
		case r.URL.Path == "/apis/site/v2/sports/soccer/tur.1/scoreboard":
			switch r.URL.Query().Get("dates") {
			case "20261013":
				w.Write([]byte(`{"events":[
					{"id":"9","date":"2026-10-13T16:00Z","status":{"displayClock":"67'","type":{"state":"in","completed":false,"shortDetail":"67'"}},"competitions":[{"competitors":[{"homeAway":"home","score":"1","team":{"displayName":"Fenerbahçe","logo":"f.png"}},{"homeAway":"away","score":"1","team":{"displayName":"Beşiktaş","logo":"b.png"}}]}]},
					{"id":"10","date":"2026-10-13T19:00Z","status":{"displayClock":"0'","type":{"state":"pre","completed":false,"shortDetail":"10/13 - 7:00 PM"}},"competitions":[{"competitors":[{"homeAway":"home","score":"0","team":{"displayName":"Samsunspor","logo":"s.png"}},{"homeAway":"away","score":"0","team":{"displayName":"Göztepe","logo":"z.png"}}]}]}]}`))
			case "20261011":
				w.Write([]byte(`{"events":[{"id":"7","date":"2026-10-11T17:00Z","status":{"displayClock":"90'+4'","type":{"state":"post","completed":true,"shortDetail":"FT"}},"competitions":[{"competitors":[{"homeAway":"home","score":"2","team":{"displayName":"Galatasaray","logo":"g.png"}},{"homeAway":"away","score":"0","team":{"displayName":"Trabzonspor","logo":"t.png"}}]}]},
					{"id":"8","date":"2026-10-11T19:00Z","status":{"displayClock":"0'","type":{"state":"post","completed":false,"shortDetail":"Postponed"}},"competitions":[{"competitors":[{"homeAway":"home","score":"","team":{"displayName":"Kasımpaşa","logo":"k.png"}},{"homeAway":"away","score":"","team":{"displayName":"Alanyaspor","logo":"a.png"}}]}]}]}`))
			case "20261004":
				w.Write([]byte(`{"events":[{"id":"5","date":"2026-10-04T17:00Z","status":{"displayClock":"90'","type":{"state":"post","completed":true,"shortDetail":"FT"}},"competitions":[{"competitors":[{"homeAway":"home","score":"3","team":{"displayName":"Rizespor","logo":"r.png"}},{"homeAway":"away","score":"1","team":{"displayName":"Konyaspor","logo":"c.png"}}]}]}]}`))
			default:
				t.Errorf("unexpected day %s", r.URL.RawQuery)
				w.Write([]byte(`{"events":[]}`))
			}
		case r.URL.Path == "/apis/site/v2/sports/soccer/tur.1/statistics":
			w.Write([]byte(`{"season":{"displayName":"2026-27 Turkish Super Lig"},"stats":[
				{"name":"goalsLeaders","leaders":[{"value":7,"displayValue":"Matches: 7, Goals: 7","athlete":{"displayName":"Oyuncu A","team":{"displayName":"Trabzonspor","logos":[{"href":"t.png"}]}}}]},
				{"name":"assistsLeaders","leaders":[{"value":3,"displayValue":"Matches: 7, Assists: 3","athlete":{"displayName":"Oyuncu B"}}]}]}`))
		default:
			http.NotFound(w, r)
		}
	}))
}

func TestMajorLeaguesFromESPNWithCache(t *testing.T) {
	var calls int32
	srv := espnStub(t, &calls)
	defer srv.Close()
	svc := application.New(provider.New(srv.URL), ankara.New("http://127.0.0.1:1"))
	svc.SetClock(func() time.Time { return time.Date(2026, 10, 13, 17, 0, 0, 0, time.UTC) })
	ctx := context.Background()

	standings, err := svc.Standings(ctx, "super-lig")
	if err != nil || standings.Season != "2026-27" || len(standings.Rows) != 1 || standings.Rows[0].Won != 5 || standings.Rows[0].GoalsFor != 16 || standings.Rows[0].Description != "Champions League" {
		t.Fatalf("standings: %+v %v", standings, err)
	}
	before := atomic.LoadInt32(&calls)
	if _, err := svc.Standings(ctx, "super-lig"); err != nil || atomic.LoadInt32(&calls) != before {
		t.Fatal("second standings read should come from the cache")
	}

	live, err := svc.Live(ctx, "super-lig")
	if err != nil || live.Date != "2026-10-13" || len(live.Items) != 2 || live.Items[0].Status != "live" || *live.Items[0].Elapsed != 67 || live.Items[1].HomeGoals != nil {
		t.Fatalf("live: %+v %v", live, err)
	}

	results, err := svc.Results(ctx, "super-lig")
	if err != nil {
		t.Fatal(err)
	}
	ids := []int{}
	for _, f := range results.Items {
		ids = append(ids, f.ID)
	}
	// Finished matches only (the postponed one and today's unfinished ones are left out), newest first.
	if len(ids) != 2 || ids[0] != 7 || ids[1] != 5 || results.Season != "2026-27" {
		t.Fatalf("results: %v season=%q", ids, results.Season)
	}

	stats, err := svc.Stats(ctx, "super-lig")
	if err != nil || stats.TopScorers[0].Value != 7 || stats.TopScorers[0].Appearances != 7 || stats.TopScorers[0].Team.Name != "Trabzonspor" || stats.TopAssists[0].Value != 3 {
		t.Fatalf("stats: %+v %v", stats, err)
	}
	if _, err := svc.Standings(ctx, "unknown"); !errors.Is(err, domain.ErrUnknownCompetition) {
		t.Fatal("unknown competition accepted")
	}
	if got := svc.Catalog().Competitions[0].Slug; got != "super-lig" {
		t.Fatalf("Süper Lig must be first, got %s", got)
	}
}

const ankaraPage = `<html><body>
<form id="frmFilter">
<select name="sezon"><option value="20">2026-2027 Sezonu</option><option value="19" selected>2025-2026 Sezonu</option></select>
<select id="selLig" name="lig"><option value="1155" selected>Süper Amatör lig</option><option value="1156">1. Amatör Lig</option></select>
<select id="selGrup" name="grup"><option value="0">Grup yok</option><option value="1289" selected>1. GRUP</option></select>
</form>
<table class="table table-hover table-standings"><thead><tr><th>#</th><th>Takım</th></tr></thead><tbody>
<tr><td>1</td><td><div class="team-meta"><figure><img src="/files/logo/a.png"></figure><h6>BARIŞSPOR</h6></div></td><td>5</td><td>4</td><td>0</td><td>1</td><td>31</td><td>5</td><td>26</td><td>12</td></tr>
<tr><td>2</td><td><div class="team-meta"><figure><img src="/assets/img/futbol.jpg"></figure><h6>&#199;UBUK SPOR</h6></div></td><td>4</td><td>3</td><td>0</td><td>1</td><td>17</td><td>4</td><td>13</td><td>9</td></tr>
</tbody></table>
<button class="btn btn-danger" data-hafta="2">2</button>
<div class="clshaftamaclari" id="machafta-1"><ul><li class="widget-results__item">
<div class="widget-results__title"><span>3 Ekim 2026 Cumartesi</span></div>
<h5 class="widget-results__team-name">BARIŞSPOR</h5>
<div class="widget-results__score"><span class="widget-results__score-winner">3</span><span> - </span><span class="widget-results__score-loser">0</span><div class="widget-results__status">MS</div></div>
<h5 class="widget-results__team-name">ÇUBUK SPOR</h5>
<div class="widget-results__venue"><span>MAMAK STADI </span><span> - 10:00</span></div>
</li></ul></div>
<div class="clshaftamaclari" id="machafta-2"><ul><li class="widget-results__item">
<div class="widget-results__title"><span>10 Ekim 2026 Cumartesi</span></div>
<h5 class="widget-results__team-name">ÇUBUK SPOR</h5>
<div class="widget-results__score"><span class="widget-results__score-winner"></span><span> - </span><span class="widget-results__score-loser"></span><div class="widget-results__status">-</div></div>
<h5 class="widget-results__team-name">BARIŞSPOR</h5>
<div class="widget-results__venue"><span>SAHA BELİRSİZ</span><span> - Saati belirlenmedi</span></div>
</li></ul></div>
</body></html>`

func TestAnkaraSelectionParsesTableAndWeeks(t *testing.T) {
	var query string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query = r.URL.RawQuery
		w.Write([]byte(ankaraPage))
	}))
	defer srv.Close()
	svc := application.New(provider.New("http://127.0.0.1:1"), ankara.New(srv.URL))
	out, err := svc.Ankara(context.Background(), "19", "1155", "1289")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(query, "sezon=19") || !strings.Contains(query, "lig=1155") || !strings.Contains(query, "grup=1289") {
		t.Fatalf("upstream query: %s", query)
	}
	if !out.Seasons[1].Selected || out.Leagues[0].Name != "Süper Amatör lig" || !out.Groups[1].Selected {
		t.Fatalf("options: %+v %+v %+v", out.Seasons, out.Leagues, out.Groups)
	}
	if len(out.Standings) != 2 || out.Standings[0].Team.LogoURL != srv.URL+"/files/logo/a.png" || out.Standings[1].Team.LogoURL != "" || out.Standings[1].Team.Name != "ÇUBUK SPOR" || out.Standings[0].Points != 12 {
		t.Fatalf("standings: %+v", out.Standings)
	}
	if out.CurrentWeek != 2 || len(out.Weeks) != 2 {
		t.Fatalf("weeks: current=%d %d", out.CurrentWeek, len(out.Weeks))
	}
	played, upcoming := out.Weeks[0].Matches[0], out.Weeks[1].Matches[0]
	if played.HomeGoals == nil || *played.HomeGoals != 3 || played.Status != "MS" || played.Venue != "MAMAK STADI" || played.Time != "10:00" {
		t.Fatalf("played match: %+v", played)
	}
	if upcoming.HomeGoals != nil || upcoming.Home != "ÇUBUK SPOR" || upcoming.Time != "Saati belirlenmedi" {
		t.Fatalf("upcoming match: %+v", upcoming)
	}
	if _, err := svc.Ankara(context.Background(), "19;drop", "", ""); !errors.Is(err, domain.ErrInvalidSelection) {
		t.Fatal("non-numeric selection accepted")
	}
}

// cupStub mimics ESPN for a UEFA cup: the calendar lists stages with dated
// rounds (the real shape) and the scoreboard answers month queries.
func cupStub(t *testing.T, months *[]string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		finished := func(id, date, home, away, hs, as string) string {
			return `{"id":"` + id + `","date":"` + date + `","status":{"displayClock":"90'","type":{"state":"post","completed":true,"shortDetail":"FT"}},"competitions":[{"competitors":[{"homeAway":"home","score":"` + hs + `","team":{"displayName":"` + home + `","logo":"h.png"}},{"homeAway":"away","score":"` + as + `","team":{"displayName":"` + away + `","logo":"a.png"}}]}]}`
		}
		switch {
		case r.URL.Path == "/apis/v2/sports/soccer/uefa.champions/standings":
			w.Write([]byte(`{"children":[{"name":"League Phase","standings":{"seasonDisplayName":"2026-27 UEFA Champions League","entries":[
				{"team":{"displayName":"Barcelona","logos":[{"href":"b.png"}]},"note":{"description":"Qualifies for round of 16"},"stats":[{"name":"rank","value":1},{"name":"gamesPlayed","value":2},{"name":"wins","value":2},{"name":"points","value":6}]},
				{"team":{"displayName":"Galatasaray","logos":[{"href":"g.png"}]},"note":{"description":"Knockout phase playoffs - seeded"},"stats":[{"name":"rank","value":9},{"name":"gamesPlayed","value":2},{"name":"points","value":3}]},
				{"team":{"displayName":"Lille","logos":[{"href":"l.png"}]},"note":{"description":"Eliminated"},"stats":[{"name":"rank","value":36},{"name":"gamesPlayed","value":2}]}]}}]}`))
		case r.URL.Path == "/apis/site/v2/sports/soccer/uefa.champions/scoreboard" && r.URL.Query().Get("dates") == "":
			w.Write([]byte(`{"leagues":[{"calendarType":"list","calendar":[{"label":"UEFA Champions League","startDate":"2026-07-01T04:00Z","endDate":"2027-07-01T03:59Z","entries":[
				{"label":"League Phase","detail":"Sep 8-Jan 27","value":"1","startDate":"2026-08-27T07:00Z","endDate":"2027-02-15T07:59Z"},
				{"label":"Final","detail":"Jun 1-30","value":"6","startDate":"2027-06-01T07:00Z","endDate":"2027-07-01T06:59Z"}]}]}],"events":[]}`))
		case r.URL.Path == "/apis/site/v2/sports/soccer/uefa.champions/scoreboard":
			if r.URL.Query().Get("limit") == "" {
				t.Errorf("month query without limit: %s", r.URL.RawQuery)
			}
			*months = append(*months, r.URL.Query().Get("dates"))
			switch r.URL.Query().Get("dates") {
			case "202610":
				w.Write([]byte(`{"events":[` + finished("21", "2026-10-13T19:00Z", "Galatasaray", "Barcelona", "1", "4") + `,
					{"id":"22","date":"2026-10-21T19:00Z","status":{"displayClock":"0'","type":{"state":"pre","completed":false,"shortDetail":"10/21"}},"competitions":[{"competitors":[{"homeAway":"home","score":"0","team":{"displayName":"Lille","logo":"l.png"}},{"homeAway":"away","score":"0","team":{"displayName":"Arsenal","logo":"r.png"}}]}]}]}`))
			case "202609":
				w.Write([]byte(`{"events":[` + finished("11", "2026-09-09T19:00Z", "Barcelona", "Lille", "5", "1") + `]}`))
			default:
				w.Write([]byte(`{"events":[]}`))
			}
		default:
			http.NotFound(w, r)
		}
	}))
}

func TestCupsAreServedBesideTheLeagues(t *testing.T) {
	var months []string
	srv := cupStub(t, &months)
	defer srv.Close()
	svc := application.New(provider.New(srv.URL), ankara.New("http://127.0.0.1:1"))
	svc.SetClock(func() time.Time { return time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC) })
	ctx := context.Background()

	catalog := svc.Catalog()
	if len(catalog.Competitions) != 6 || len(catalog.Cups) != 3 {
		t.Fatalf("catalog: %d leagues, %d cups", len(catalog.Competitions), len(catalog.Cups))
	}
	want := []string{"champions-league", "europa-league", "conference-league"}
	for i, cup := range catalog.Cups {
		if cup.Slug != want[i] || cup.Country != "UEFA" || !strings.HasPrefix(cup.LogoURL, "https://a.espncdn.com/") {
			t.Fatalf("cup %d: %+v", i, cup)
		}
		if _, ok := domain.CompetitionBySlug(cup.Slug); !ok {
			t.Fatalf("%s not found by slug", cup.Slug)
		}
	}
	for _, league := range catalog.Competitions {
		for _, cup := range catalog.Cups {
			if league.Slug == cup.Slug {
				t.Fatalf("%s is both a league and a cup", cup.Slug)
			}
		}
	}

	standings, err := svc.Standings(ctx, "champions-league")
	if err != nil || standings.Season != "2026-27" || len(standings.Rows) != 3 || standings.Rows[0].Group != "" {
		t.Fatalf("cup standings: %+v %v", standings, err)
	}
	// The provider's notes reach the app untouched; the app translates them.
	notes := []string{standings.Rows[0].Description, standings.Rows[1].Description, standings.Rows[2].Description}
	if notes[0] != "Qualifies for round of 16" || notes[1] != "Knockout phase playoffs - seeded" || notes[2] != "Eliminated" {
		t.Fatalf("notes: %v", notes)
	}

	results, err := svc.Results(ctx, "champions-league")
	if err != nil {
		t.Fatal(err)
	}
	ids := []int{}
	for _, f := range results.Items {
		ids = append(ids, f.ID)
	}
	// This month and the previous one; the scheduled match is left out.
	if len(ids) != 2 || ids[0] != 21 || ids[1] != 11 || results.Season != "2026-27" {
		t.Fatalf("cup results: %v season=%q", ids, results.Season)
	}
	if strings.Join(months, ",") != "202610,202609" {
		t.Fatalf("months read: %v", months)
	}
	if _, err := svc.Results(ctx, "champions-league"); err != nil || len(months) != 2 {
		t.Fatalf("second read should come from the cache: %v %v", months, err)
	}
}

func TestCupResultsSkipMonthsOutsideTheRounds(t *testing.T) {
	var months []string
	srv := cupStub(t, &months)
	defer srv.Close()
	svc := application.New(provider.New(srv.URL), ankara.New("http://127.0.0.1:1"))
	// September and August 2027 lie after the season's last round.
	svc.SetClock(func() time.Time { return time.Date(2027, 9, 20, 12, 0, 0, 0, time.UTC) })
	results, err := svc.Results(context.Background(), "champions-league")
	if err != nil || len(results.Items) != 0 {
		t.Fatalf("summer break: %+v %v", results, err)
	}
	if len(months) != 0 {
		t.Fatalf("months outside the calendar were read: %v", months)
	}
}
