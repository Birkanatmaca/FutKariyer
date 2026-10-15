// Command gamecatalog rebuilds the Arma İzi catalog (questions.json,
// clubs.json and assets/) from Wikidata (CC0) and ESPN crests. Developers run
// it offline; the API only embeds its output.
//
//	cd backend && go run ./cmd/gamecatalog -cache /tmp/gamecatalog-cache
package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"image/png"
	"io"
	"log/slog"
	"math/rand/v2"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"

	"futcareer/backend/internal/games/catalog"
	"futcareer/backend/internal/games/catalog/build"
)

const (
	userAgent = "FutCareer-catalog/1.0 (contact: birkan.atmaca@priente.com)"
	sparqlURL = "https://query.wikidata.org/sparql"
	entity    = "http://www.wikidata.org/entity/"
	superLig  = "Q485568"
)

// ESPN leagues whose historical standings are used to find club ids.
var espnLeagues = []string{
	"eng.1", "eng.2", "eng.3", "sco.1", "esp.1", "esp.2", "ita.1", "ita.2", "ger.1", "ger.2",
	"fra.1", "fra.2", "por.1", "ned.1", "bel.1", "tur.1", "gre.1", "rus.1", "ukr.1", "aut.1",
	"sui.1", "den.1", "swe.1", "nor.1", "usa.1", "mex.1", "bra.1", "arg.1", "ksa.1", "chn.1",
	"jpn.1", "cyp.1", "aus.1", "col.1", "uru.1", "chi.1", "kor.1", "isr.1", "qat.1", "uae.1", "irl.1",
}

type config struct {
	out, cache        string
	pause             time.Duration
	minLinks, minTR   int
	firstSeason, last int
	sample            int
	seed              uint64
	opts              build.Options
}

func main() {
	if err := run(); err != nil {
		slog.Error("game catalog failed", "error", err)
		os.Exit(1)
	}
}

func run() error {
	c := config{opts: build.DefaultOptions()}
	flag.StringVar(&c.out, "out", "internal/games/catalog", "catalog directory to rewrite")
	flag.StringVar(&c.cache, "cache", "", "directory caching raw responses (re-runs make no requests)")
	flag.DurationVar(&c.pause, "pause", time.Second, "pause between Wikidata queries")
	flag.IntVar(&c.minLinks, "min-links", 40, "minimum sitelinks for a candidate")
	flag.IntVar(&c.minTR, "min-links-superlig", 25, "minimum sitelinks for Süper Lig players")
	flag.IntVar(&c.firstSeason, "first-season", 2002, "oldest ESPN standings season")
	flag.IntVar(&c.last, "last-season", time.Now().Year(), "newest ESPN standings season")
	flag.IntVar(&c.opts.EasyMin, "easy", c.opts.EasyMin, "score for easy")
	flag.IntVar(&c.opts.MediumMin, "medium", c.opts.MediumMin, "score for medium")
	flag.IntVar(&c.opts.HardMin, "hard", c.opts.HardMin, "score for hard")
	flag.IntVar(&c.opts.SuperLigBonus, "superlig-bonus", c.opts.SuperLigBonus, "score bonus for Süper Lig careers")
	flag.IntVar(&c.sample, "sample", 15, "random questions to print per difficulty")
	flag.Uint64Var(&c.seed, "seed", 1, "seed for the printed sample only")
	flag.Parse()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	f := &fetcher{client: &http.Client{Timeout: 90 * time.Second}, cache: c.cache, pause: c.pause}
	return generate(ctx, f, c)
}

func generate(ctx context.Context, f *fetcher, c config) error {
	legacy, err := readLegacy(filepath.Join(c.out, "clubs.json"))
	if err != nil {
		return err
	}
	slog.Info("fetching candidates")
	qids, err := candidates(ctx, f, c)
	if err != nil {
		return err
	}
	slog.Info("candidates", "count", len(qids))
	players, err := fetchPlayers(ctx, f, qids)
	if err != nil {
		return err
	}
	clubSet := map[string]bool{}
	for _, p := range players {
		for _, s := range p.Stints {
			clubSet[s.Club] = true
		}
	}
	clubs, names, err := fetchClubs(ctx, f, keys(clubSet))
	if err != nil {
		return err
	}
	teams, err := espnTeams(ctx, f, c.firstSeason, c.last)
	if err != nil {
		return err
	}
	matched := build.MatchESPN(names, teams)
	for i := range clubs {
		if clubs[i].ESPNID != "" {
			clubs[i].ESPNMatch = "wikidata"
		} else if id := matched[clubs[i].QID]; id != "" {
			clubs[i].ESPNID, clubs[i].ESPNMatch = id, "espn-standings"
		}
	}
	crests := map[string][]byte{}
	for _, l := range legacy {
		if id := build.LegacyESPN(l); id != "" && build.IsLegacy(l) {
			if crests[id], err = crest(ctx, f, id); err != nil {
				return fmt.Errorf("legacy crest %s: %w", l.ID, err)
			}
		}
	}
	for i, cl := range clubs {
		if cl.ESPNID == "" || !build.EligibleClub(cl) {
			continue
		}
		if _, ok := crests[cl.ESPNID]; !ok {
			data, err := crest(ctx, f, cl.ESPNID)
			if err != nil {
				slog.Warn("crest unavailable", "club", cl.QID, "espn", cl.ESPNID, "error", err)
			}
			crests[cl.ESPNID] = data
		}
		clubs[i].Crest = crests[cl.ESPNID] != nil
	}
	res, err := build.Build(players, clubs, legacy, c.opts)
	if err != nil {
		return err
	}
	if err = write(c.out, res, crests); err != nil {
		return err
	}
	if _, err = catalog.LoadFS(os.DirFS(c.out)); err != nil {
		return fmt.Errorf("generated catalog is invalid: %w", err)
	}
	fmt.Println(res.Summary())
	reasons := map[string]bool{}
	for r := range res.Rejected {
		reasons[r] = true
	}
	for _, r := range keys(reasons) {
		fmt.Printf("rejected %-32s %d\n", r, res.Rejected[r])
	}
	printSample(res, c.sample, c.seed)
	return nil
}

func readLegacy(path string) ([]catalog.Club, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var clubs []catalog.Club
	return clubs, json.Unmarshal(data, &clubs)
}

func keys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// fetcher performs polite, cached HTTP requests with retries.
type fetcher struct {
	client *http.Client
	cache  string
	pause  time.Duration
}

func (f *fetcher) get(ctx context.Context, method, rawURL, body string, polite bool) ([]byte, int, error) {
	sum := sha256.Sum256([]byte(method + " " + rawURL + "\n" + body))
	path := ""
	if f.cache != "" {
		path = filepath.Join(f.cache, hex.EncodeToString(sum[:16]))
		if data, err := os.ReadFile(path); err == nil {
			if len(data) == 0 {
				return nil, http.StatusNotFound, nil
			}
			return data, http.StatusOK, nil
		}
	}
	var lastErr error
	for attempt := 0; attempt < 4; attempt++ {
		if attempt > 0 || polite {
			wait := f.pause
			if attempt > 0 {
				wait = time.Duration(1<<attempt) * time.Second
			}
			select {
			case <-ctx.Done():
				return nil, 0, ctx.Err()
			case <-time.After(wait):
			}
		}
		req, err := http.NewRequestWithContext(ctx, method, rawURL, strings.NewReader(body))
		if err != nil {
			return nil, 0, err
		}
		if strings.HasPrefix(rawURL, sparqlURL) {
			// Wikidata asks bots for a descriptive agent. ESPN's edge rejects
			// unknown agents, so its requests keep Go's default.
			req.Header.Set("User-Agent", userAgent)
			req.Header.Set("Accept", "application/sparql-results+json")
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		}
		resp, err := f.client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		data, err := io.ReadAll(io.LimitReader(resp.Body, 64<<20))
		resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}
		if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("%s: status %d", rawURL, resp.StatusCode)
			if s, err := strconv.Atoi(resp.Header.Get("Retry-After")); err == nil && s > 0 && s <= 60 {
				time.Sleep(time.Duration(s) * time.Second)
			}
			continue
		}
		if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusBadRequest {
			if path != "" {
				_ = os.WriteFile(path, nil, 0o644)
			}
			return nil, resp.StatusCode, nil
		}
		if resp.StatusCode != http.StatusOK {
			return nil, resp.StatusCode, fmt.Errorf("%s: status %d", rawURL, resp.StatusCode)
		}
		if path != "" {
			if err := os.MkdirAll(f.cache, 0o755); err == nil {
				_ = os.WriteFile(path, data, 0o644)
			}
		}
		return data, resp.StatusCode, nil
	}
	return nil, 0, lastErr
}

type binding map[string]string

// sparql runs a query and returns each row's values (entity IRIs reduced to QIDs).
func sparql(ctx context.Context, f *fetcher, query string) ([]binding, error) {
	data, _, err := f.get(ctx, http.MethodPost, sparqlURL, url.Values{"query": {query}}.Encode(), true)
	if err != nil {
		return nil, err
	}
	var out struct {
		Results struct {
			Bindings []map[string]struct {
				Value string `json:"value"`
			} `json:"bindings"`
		} `json:"results"`
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, fmt.Errorf("sparql response: %w", err)
	}
	rows := make([]binding, 0, len(out.Results.Bindings))
	for _, b := range out.Results.Bindings {
		row := binding{}
		for k, v := range b {
			row[k] = strings.TrimPrefix(v.Value, entity)
		}
		rows = append(rows, row)
	}
	return rows, nil
}

func values(qids []string) string {
	return "wd:" + strings.Join(qids, " wd:")
}

func batches(qids []string, size int) [][]string {
	var out [][]string
	for len(qids) > 0 {
		n := min(size, len(qids))
		out = append(out, qids[:n])
		qids = qids[n:]
	}
	return out
}

const born = `"1965-01-01T00:00:00Z"^^xsd:dateTime`

func candidates(ctx context.Context, f *fetcher, c config) ([]string, error) {
	global := fmt.Sprintf(`SELECT ?p WHERE { hint:Query hint:optimizer "None". ?p wdt:P106 wd:Q937857 . ?p wikibase:sitelinks ?l . FILTER(?l >= %d) ?p wdt:P569 ?b . FILTER(?b >= %s) }`, c.minLinks, born)
	turkish := fmt.Sprintf(`SELECT DISTINCT ?p WHERE { hint:Query hint:optimizer "None". ?c wdt:P118 wd:%s . ?p wdt:P54 ?c . ?p wdt:P106 wd:Q937857 . ?p wikibase:sitelinks ?l . FILTER(?l >= %d) ?p wdt:P569 ?b . FILTER(?b >= %s) }`, superLig, c.minTR, born)
	set := map[string]bool{}
	for _, q := range []string{global, turkish} {
		rows, err := sparql(ctx, f, q)
		if err != nil {
			return nil, err
		}
		for _, r := range rows {
			set[r["p"]] = true
		}
	}
	return keys(set), nil
}

func fetchPlayers(ctx context.Context, f *fetcher, qids []string) ([]build.PlayerData, error) {
	byQID := map[string]*build.PlayerData{}
	positions := map[string][]string{}
	nations := map[string]map[string][]string{}
	for i, batch := range batches(qids, 150) {
		slog.Info("players", "batch", i+1, "of", (len(qids)+149)/150)
		v := values(batch)
		// Plain rows (GROUP BY here trips a WDQS planner error); several birth
		// dates keep the earliest year.
		rows, err := sparql(ctx, f, `SELECT ?p ?en ?tr ?b ?l WHERE { VALUES ?p { `+v+` } ?p wikibase:sitelinks ?l . OPTIONAL { ?p wdt:P569 ?b } OPTIONAL { ?p rdfs:label ?en FILTER(LANG(?en)="en") } OPTIONAL { ?p rdfs:label ?tr FILTER(LANG(?tr)="tr") } }`)
		if err != nil {
			return nil, err
		}
		for _, r := range rows {
			year, _ := strconv.Atoi(firstN(r["b"], 4))
			links, _ := strconv.Atoi(r["l"])
			p := byQID[r["p"]]
			if p == nil {
				p = &build.PlayerData{QID: r["p"], LabelEN: r["en"], LabelTR: r["tr"], BirthYear: year, Sitelinks: links}
				byQID[r["p"]] = p
			}
			if year > 0 && (p.BirthYear == 0 || year < p.BirthYear) {
				p.BirthYear = year
			}
		}
		rows, err = sparql(ctx, f, `SELECT ?p ?club ?start ?end WHERE { VALUES ?p { `+v+` } ?p p:P54 ?st . ?st ps:P54 ?club . OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } }`)
		if err != nil {
			return nil, err
		}
		for _, r := range rows {
			if p := byQID[r["p"]]; p != nil && strings.HasPrefix(r["club"], "Q") {
				p.Stints = append(p.Stints, build.Stint{Club: r["club"], Start: firstN(r["start"], 10), End: firstN(r["end"], 10)})
			}
		}
		rows, err = sparql(ctx, f, `SELECT ?p ?pos WHERE { VALUES ?p { `+v+` } ?p wdt:P413 ?pos }`)
		if err != nil {
			return nil, err
		}
		for _, r := range rows {
			positions[r["p"]] = append(positions[r["p"]], r["pos"])
		}
		rows, err = sparql(ctx, f, `SELECT ?p ?kind ?c WHERE { VALUES ?p { `+v+` } { ?p wdt:P1532 ?c BIND("sport" AS ?kind) } UNION { ?p wdt:P27 ?c BIND("citizen" AS ?kind) } }`)
		if err != nil {
			return nil, err
		}
		for _, r := range rows {
			if nations[r["p"]] == nil {
				nations[r["p"]] = map[string][]string{}
			}
			nations[r["p"]][r["kind"]] = append(nations[r["p"]][r["kind"]], r["c"])
		}
	}
	coarse, err := coarsePositions(ctx, f, positions)
	if err != nil {
		return nil, err
	}
	countryNames, err := countryLabels(ctx, f, nations)
	if err != nil {
		return nil, err
	}
	out := make([]build.PlayerData, 0, len(byQID))
	for _, q := range qids {
		p := byQID[q]
		if p == nil {
			continue
		}
		for _, pos := range positions[q] {
			if v := coarse[pos]; v != "" {
				p.Positions = append(p.Positions, v)
			}
		}
		p.Nationality = countryNames[nationality(nations[q])]
		sort.Slice(p.Stints, func(i, j int) bool {
			a, b := p.Stints[i], p.Stints[j]
			return a.Start+a.End+a.Club < b.Start+b.End+b.Club
		})
		out = append(out, *p)
	}
	return out, nil
}

func firstN(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}

// nationality prefers "country for sport" (P1532) over citizenship.
func nationality(n map[string][]string) string {
	for _, kind := range []string{"sport", "citizen"} {
		list := append([]string{}, n[kind]...)
		sort.Strings(list)
		if len(list) > 0 {
			return list[0]
		}
	}
	return ""
}

func coarsePositions(ctx context.Context, f *fetcher, positions map[string][]string) (map[string]string, error) {
	set := map[string]bool{}
	for _, list := range positions {
		for _, p := range list {
			if strings.HasPrefix(p, "Q") {
				set[p] = true
			}
		}
	}
	out := map[string]string{}
	roots := map[string]string{"Q201330": "kaleci", "Q336286": "defans", "Q193592": "orta saha", "Q280658": "forvet"}
	for _, batch := range batches(keys(set), 200) {
		rows, err := sparql(ctx, f, `SELECT ?pos ?root WHERE { VALUES ?pos { `+values(batch)+` } VALUES ?root { wd:Q201330 wd:Q336286 wd:Q193592 wd:Q280658 } ?pos wdt:P279* ?root }`)
		if err != nil {
			return nil, err
		}
		sort.Slice(rows, func(i, j int) bool { return rows[i]["pos"]+rows[i]["root"] < rows[j]["pos"]+rows[j]["root"] })
		for _, r := range rows {
			if out[r["pos"]] == "" {
				out[r["pos"]] = roots[r["root"]]
			}
		}
	}
	return out, nil
}

func countryLabels(ctx context.Context, f *fetcher, nations map[string]map[string][]string) (map[string]string, error) {
	set := map[string]bool{}
	for _, n := range nations {
		if q := nationality(n); strings.HasPrefix(q, "Q") {
			set[q] = true
		}
	}
	out := map[string]string{}
	for _, batch := range batches(keys(set), 200) {
		rows, err := sparql(ctx, f, `SELECT ?c ?en ?tr WHERE { VALUES ?c { `+values(batch)+` } OPTIONAL { ?c rdfs:label ?en FILTER(LANG(?en)="en") } OPTIONAL { ?c rdfs:label ?tr FILTER(LANG(?tr)="tr") } }`)
		if err != nil {
			return nil, err
		}
		for _, r := range rows {
			out[r["c"]] = build.DisplayName(r["tr"], r["en"])
		}
	}
	return out, nil
}

func fetchClubs(ctx context.Context, f *fetcher, qids []string) ([]build.ClubData, []build.ClubNames, error) {
	clubs := []build.ClubData{}
	names := []build.ClubNames{}
	for i, batch := range batches(qids, 150) {
		slog.Info("clubs", "batch", i+1, "of", (len(qids)+149)/150)
		v := values(batch)
		rows, err := sparql(ctx, f, `SELECT ?c ?en ?tr ?l ?espn ?nat ?res ?youth ?women ?team ?sl
WHERE { VALUES ?c { `+v+` }
 OPTIONAL { ?c wikibase:sitelinks ?l }
 OPTIONAL { ?c rdfs:label ?en FILTER(LANG(?en)="en") }
 OPTIONAL { ?c rdfs:label ?tr FILTER(LANG(?tr)="tr") }
 OPTIONAL { ?c wdt:P13590 ?espn }
 BIND(EXISTS { ?c wdt:P31/wdt:P279* wd:Q6979593 } AS ?nat)
 BIND(EXISTS { ?c wdt:P31/wdt:P279* wd:Q2412834 } AS ?res)
 BIND(EXISTS { { ?c wdt:P31/wdt:P279* wd:Q21945604 } UNION { ?c wdt:P31 wd:Q134468886 } } AS ?youth)
 BIND(EXISTS { { ?c wdt:P31/wdt:P279* wd:Q51481377 } UNION { ?c wdt:P31/wdt:P279* wd:Q28140340 } UNION { ?c wdt:P31/wdt:P279* wd:Q23905105 } } AS ?women)
 BIND(EXISTS { { ?c wdt:P31/wdt:P279* wd:Q12973014 } UNION { ?c wdt:P31/wdt:P279* wd:Q847017 } } AS ?team)
 BIND(EXISTS { ?c wdt:P118 wd:`+superLig+` } AS ?sl)
}`)
		if err != nil {
			return nil, nil, err
		}
		sort.Slice(rows, func(i, j int) bool {
			a, b := rows[i], rows[j]
			if a["c"] != b["c"] {
				return a["c"] < b["c"]
			}
			if len(a["espn"]) != len(b["espn"]) {
				return len(a["espn"]) < len(b["espn"])
			}
			return a["espn"] < b["espn"]
		})
		got := map[string]int{}
		for _, r := range rows {
			if i, ok := got[r["c"]]; ok {
				// Extra rows only repeat the item with another ESPN id; the
				// lowest numeric id (first after sorting) is kept.
				if clubs[i].ESPNID == "" {
					clubs[i].ESPNID = r["espn"]
				}
				continue
			}
			links, _ := strconv.Atoi(r["l"])
			c := build.ClubData{QID: r["c"], LabelEN: r["en"], LabelTR: r["tr"], Sitelinks: links, ESPNID: r["espn"],
				National: r["nat"] == "true", Reserve: r["res"] == "true", Youth: r["youth"] == "true", Women: r["women"] == "true",
				SportsTeam: r["team"] == "true", SuperLig: r["sl"] == "true"}
			got[c.QID] = len(clubs)
			clubs = append(clubs, c)
			names = append(names, build.ClubNames{QID: c.QID, Labels: nonEmpty(c.LabelEN, c.LabelTR)})
		}
		rows, err = sparql(ctx, f, `SELECT ?c ?country WHERE { VALUES ?c { `+v+` } ?c wdt:P17 ?country }`)
		if err != nil {
			return nil, nil, err
		}
		sort.Slice(rows, func(i, j int) bool { return rows[i]["c"]+rows[i]["country"] < rows[j]["c"]+rows[j]["country"] })
		for _, r := range rows {
			if i, ok := got[r["c"]]; ok {
				names[i].Countries = append(names[i].Countries, r["country"])
			}
		}
		rows, err = sparql(ctx, f, `SELECT ?c ?a WHERE { VALUES ?c { `+v+` } ?c skos:altLabel ?a FILTER(LANG(?a)="en") }`)
		if err != nil {
			return nil, nil, err
		}
		sort.Slice(rows, func(i, j int) bool { return rows[i]["c"]+rows[i]["a"] < rows[j]["c"]+rows[j]["a"] })
		for _, r := range rows {
			if i, ok := got[r["c"]]; ok {
				names[i].Aliases = append(names[i].Aliases, r["a"])
			}
		}
	}
	return clubs, names, nil
}

func nonEmpty(values ...string) []string {
	out := []string{}
	for _, v := range values {
		if v != "" {
			out = append(out, v)
		}
	}
	return out
}

// espnTeams reads league standings season by season (newest first) and stops
// a league after three empty seasons in a row.
func espnTeams(ctx context.Context, f *fetcher, first, last int) ([]build.ESPNTeam, error) {
	seen := map[string]bool{}
	var out []build.ESPNTeam
	saved := f.pause
	f.pause = 200 * time.Millisecond
	defer func() { f.pause = saved }()
	for _, league := range espnLeagues {
		empty := 0
		for season := last; season >= first && empty < 3; season-- {
			data, _, err := f.get(ctx, http.MethodGet, fmt.Sprintf("https://site.api.espn.com/apis/v2/sports/soccer/%s/standings?season=%d", league, season), "", true)
			if err != nil {
				return nil, err
			}
			teams := parseStandings(data)
			if len(teams) == 0 {
				empty++
				continue
			}
			empty = 0
			for _, t := range teams {
				t.League = league
				k := t.ID + "|" + league + "|" + strings.Join(t.Names, "|")
				if !seen[k] {
					seen[k] = true
					out = append(out, t)
				}
			}
		}
		slog.Info("espn standings", "league", league, "teams", len(out))
	}
	return out, nil
}

func parseStandings(data []byte) []build.ESPNTeam {
	type entry struct {
		Team struct {
			ID               string `json:"id"`
			DisplayName      string `json:"displayName"`
			ShortDisplayName string `json:"shortDisplayName"`
			Name             string `json:"name"`
		} `json:"team"`
	}
	type table struct {
		Standings struct {
			Entries []entry `json:"entries"`
		} `json:"standings"`
	}
	var doc struct {
		table
		Children []table `json:"children"`
	}
	if len(data) == 0 || json.Unmarshal(data, &doc) != nil {
		return nil
	}
	var out []build.ESPNTeam
	for _, t := range append(doc.Children, doc.table) {
		for _, e := range t.Standings.Entries {
			if e.Team.ID != "" {
				out = append(out, build.ESPNTeam{ID: e.Team.ID, Names: nonEmpty(e.Team.DisplayName, e.Team.ShortDisplayName, e.Team.Name)})
			}
		}
	}
	return out
}

// crest downloads a 128 px crest and checks it really is a PNG.
func crest(ctx context.Context, f *fetcher, espnID string) ([]byte, error) {
	saved := f.pause
	f.pause = 100 * time.Millisecond
	defer func() { f.pause = saved }()
	u := "https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/" + espnID + ".png&w=128&h=128"
	data, status, err := f.get(ctx, http.MethodGet, u, "", true)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("status %d", status)
	}
	cfg, err := png.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width < 64 || cfg.Height < 64 {
		return nil, fmt.Errorf("not a crest png")
	}
	return data, nil
}

func write(dir string, res build.Result, crests map[string][]byte) error {
	if err := writeJSON(filepath.Join(dir, "questions.json"), res.Players); err != nil {
		return err
	}
	if err := writeJSON(filepath.Join(dir, "clubs.json"), res.Clubs); err != nil {
		return err
	}
	assets := filepath.Join(dir, "assets")
	if err := os.MkdirAll(assets, 0o755); err != nil {
		return err
	}
	want := map[string]bool{}
	for _, c := range res.Clubs {
		if !c.HasCrest {
			continue
		}
		data := crests[c.ESPNID]
		if data == nil {
			return fmt.Errorf("crest for %s was not downloaded", c.ID)
		}
		want[c.ID+".png"] = true
		if err := os.WriteFile(filepath.Join(assets, c.ID+".png"), data, 0o644); err != nil {
			return err
		}
	}
	entries, err := os.ReadDir(assets)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if !want[e.Name()] {
			if err := os.Remove(filepath.Join(assets, e.Name())); err != nil {
				return err
			}
		}
	}
	return nil
}

func writeJSON(path string, v any) error {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(v); err != nil {
		return err
	}
	return os.WriteFile(path, buf.Bytes(), 0o644)
}

func printSample(res build.Result, n int, seed uint64) {
	r := rand.New(rand.NewPCG(seed, seed))
	clubs := map[string]catalog.Club{}
	for _, c := range res.Clubs {
		clubs[c.ID] = c
	}
	for _, d := range []string{"easy", "medium", "hard"} {
		var pool []catalog.Player
		for _, p := range res.Players {
			if p.Difficulty == d {
				pool = append(pool, p)
			}
		}
		r.Shuffle(len(pool), func(i, j int) { pool[i], pool[j] = pool[j], pool[i] })
		fmt.Printf("\n== %s (%d) ==\n", d, len(pool))
		for _, p := range pool[:min(n, len(pool))] {
			stops := make([]string, len(p.Clubs))
			for i, id := range p.Clubs {
				mark := ""
				if !clubs[id].HasCrest {
					mark = "*"
				}
				stops[i] = clubs[id].Name + mark
			}
			fmt.Printf("%-28s %d %-9s %s\n", p.Name, p.BirthYear, p.Position, strings.Join(stops, " → "))
		}
	}
}
