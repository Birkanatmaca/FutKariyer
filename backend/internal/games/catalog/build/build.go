// Package build turns Wikidata answers into the Arma İzi catalog. It is pure
// (no network, no clock, no randomness) so cmd/gamecatalog output depends
// only on the fetched data, and every rule here is unit tested with fixtures.
package build

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"futcareer/backend/internal/games/catalog"
)

// Stint is one P54 (member of sports team) statement.
type Stint struct {
	Club  string // club QID
	Start string // "YYYY-MM-DD" from P580, "" when missing
	End   string // P582, "" when missing or ongoing
}

// PlayerData is what Wikidata says about a candidate footballer.
type PlayerData struct {
	QID         string
	LabelEN     string
	LabelTR     string
	BirthYear   int
	Sitelinks   int
	Positions   []string // coarse Turkish labels, one per P413 value
	Nationality string
	Stints      []Stint
}

// ClubData is a club item plus the type flags computed in SPARQL.
type ClubData struct {
	QID        string
	LabelEN    string
	LabelTR    string
	Sitelinks  int
	National   bool // instance of (a subclass of) national association football team
	Reserve    bool // reserve team
	Youth      bool // youth team or football academy
	Women      bool // women's team or club
	SportsTeam bool // instance of (a subclass of) sports team or sports club
	SuperLig   bool // P118 Süper Lig
	ESPNID     string
	ESPNMatch  string
	Crest      bool // a crest image was downloaded for ESPNID
}

// Options tunes the selection. Scores are sitelinks plus SuperLigBonus for
// players with a Süper Lig club in their career.
type Options struct {
	MinBirthYear  int
	EasyMin       int
	MediumMin     int
	HardMin       int
	SuperLigBonus int
	MaxClues      int
	// Exclude lists players whose Wikidata career was found wrong during
	// review (QID -> reason). Fix Wikidata first, then drop the entry.
	Exclude map[string]string
}

// reviewedExclusions are source errors seen in sample checks.
var reviewedExclusions = map[string]string{
	"Q482955": "Edwin van der Sar: Wikidata lists FC Barcelona 1990-1999 instead of Ajax (Oct 2026)",
}

func DefaultOptions() Options {
	return Options{MinBirthYear: 1965, EasyMin: 70, MediumMin: 60, HardMin: 53, SuperLigBonus: 12, MaxClues: 5, Exclude: reviewedExclusions}
}

// Result is the generated catalog plus rejection reasons for the report.
type Result struct {
	Players  []catalog.Player
	Clubs    []catalog.Club
	Rejected map[string]int
}

var (
	// Second teams, youth sides and academies by name. Checked on English and
	// Turkish labels; the type flags catch most, names catch the rest.
	youthName    = regexp.MustCompile(`(?i)(\b(u|sub)[- ]?\d{2}s?\b|\bunder[- ]?\d{2}s?\b|\b(ii|iii|b|c)$|\b(youth|reserves?|primavera|academy|akademi|jong|next gen|castilla|amateure|juvenil|promesas|res\.)\b|altyap|\batl[eè]tic$|\bbilbao athletic\b|[a-z] atl[eé]tico$|\bfutures?$|\b2$|\bdeportivo$)`)
	nationalName = regexp.MustCompile(`(?i)\bnational\b.*\bteam\b|\bmilli tak[ıi]m|\bolympic\b`)
	paren        = regexp.MustCompile(`\s*\([^)]*\)`)
)

// EligibleClub keeps senior club sides: no national, Olympic, youth, reserve,
// B/II, academy or women's teams, and only items typed as a sports team/club.
func EligibleClub(c ClubData) bool {
	if c.QID == "" || c.National || c.Reserve || c.Youth || c.Women || !c.SportsTeam {
		return false
	}
	for _, name := range []string{c.LabelEN, c.LabelTR} {
		name = strings.TrimSpace(paren.ReplaceAllString(name, ""))
		if youthName.MatchString(name) || nationalName.MatchString(name) || strings.Contains(strings.ToLower(name), "women") || strings.Contains(strings.ToLower(name), "kadın") {
			return false
		}
	}
	return c.LabelEN != "" || c.LabelTR != ""
}

// Career orders eligible stints chronologically and merges consecutive
// spells at the same club (a loan away and back stays as three stops).
// Stints without a start date cannot be ordered and are dropped.
func Career(stints []Stint, eligible func(string) bool) []string {
	kept := []Stint{}
	for _, s := range stints {
		if s.Start != "" && eligible(s.Club) {
			kept = append(kept, s)
		}
	}
	// A loan inside a longer spell elsewhere ends with a return to the
	// parent club, so the parent club reappears after the loan.
	returns := []Stint{}
	for _, parent := range kept {
		for _, loan := range kept {
			if loan.Club != parent.Club && loan.End != "" && loan.Start > parent.Start && endKey(loan.End) < endKey(parent.End) {
				returns = append(returns, Stint{Club: parent.Club, Start: loan.End, End: parent.End})
			}
		}
	}
	kept = append(kept, returns...)
	sort.SliceStable(kept, func(i, j int) bool {
		a, b := kept[i], kept[j]
		if a.Start != b.Start {
			return a.Start < b.Start
		}
		ae, be := endKey(a.End), endKey(b.End)
		if ae != be {
			return ae < be
		}
		return qidLess(a.Club, b.Club)
	})
	out := []string{}
	for _, s := range kept {
		if len(out) == 0 || out[len(out)-1] != s.Club {
			out = append(out, s.Club)
		}
	}
	return out
}

func endKey(end string) string {
	if end == "" {
		return "9999"
	}
	return end
}

// SelectClues picks at most max stops: the first and last club stay, middle
// stops prefer crest clubs, clubs not already shown, Süper Lig clubs (for
// Turkish players' recognition) and well-known clubs. Adjacent repeats are
// removed after selection.
func SelectClues(career []string, max int, crest, superLig func(string) bool, links func(string) int) []string {
	if len(career) <= max {
		return dropAdjacent(append([]string{}, career...))
	}
	chosen := map[int]bool{0: true, len(career) - 1: true}
	shown := map[string]bool{career[0]: true, career[len(career)-1]: true}
	for len(chosen) < max {
		best := -1
		for i := 1; i < len(career)-1; i++ {
			if chosen[i] {
				continue
			}
			if best < 0 || betterClue(career, i, best, shown, crest, superLig, links) {
				best = i
			}
		}
		if best < 0 {
			break
		}
		chosen[best] = true
		shown[career[best]] = true
	}
	idx := make([]int, 0, len(chosen))
	for i := range chosen {
		idx = append(idx, i)
	}
	sort.Ints(idx)
	out := make([]string, 0, len(idx))
	for _, i := range idx {
		out = append(out, career[i])
	}
	return dropAdjacent(out)
}

func betterClue(career []string, i, j int, shown map[string]bool, crest, superLig func(string) bool, links func(string) int) bool {
	a, b := career[i], career[j]
	if crest(a) != crest(b) {
		return crest(a)
	}
	if shown[a] != shown[b] {
		return !shown[a]
	}
	if superLig(a) != superLig(b) {
		return superLig(a)
	}
	if links(a) != links(b) {
		return links(a) > links(b)
	}
	return i < j
}

func dropAdjacent(clubs []string) []string {
	out := clubs[:0]
	for _, c := range clubs {
		if len(out) == 0 || out[len(out)-1] != c {
			out = append(out, c)
		}
	}
	return out
}

// Bucket maps a popularity score to a difficulty; "" means not popular enough.
func Bucket(score int, o Options) string {
	switch {
	case score >= o.EasyMin:
		return "easy"
	case score >= o.MediumMin:
		return "medium"
	case score >= o.HardMin:
		return "hard"
	}
	return ""
}

// Score is sitelinks plus the Süper Lig bonus.
func Score(p PlayerData, career []string, clubs map[string]ClubData, o Options) int {
	score := p.Sitelinks
	for _, c := range career {
		if clubs[c].SuperLig {
			return score + o.SuperLigBonus
		}
	}
	return score
}

// DisplayName prefers the Turkish label and drops disambiguation notes.
func DisplayName(tr, en string) string {
	for _, v := range []string{tr, en} {
		v = strings.TrimSpace(paren.ReplaceAllString(v, ""))
		if v != "" && !isQID(v) {
			return v
		}
	}
	return ""
}

// ClubName keeps legal forms ("FC Tokyo", "Los Angeles FC"): stripping
// them leaves bare city names that read like other clubs.
func ClubName(tr, en string) string {
	return DisplayName(tr, en)
}

// Position picks the most frequent coarse position; ties go to the earlier
// line on the pitch so the result is stable.
func Position(values []string) string {
	order := []string{"kaleci", "defans", "orta saha", "forvet"}
	count := map[string]int{}
	for _, v := range values {
		count[v]++
	}
	best := ""
	for _, v := range order {
		if count[v] > count[best] {
			best = v
		}
	}
	return best
}

type candidate struct {
	player PlayerData
	career []string
	clues  []string
	score  int
}

// Build applies every rule and returns a catalog that passes
// catalog.Validate. legacy entries keep their ids, names and crests.
func Build(players []PlayerData, clubs []ClubData, previous []catalog.Club, o Options) (Result, error) {
	res := Result{Rejected: map[string]int{}}
	legacy := []catalog.Club{}
	for _, c := range previous {
		if IsLegacy(c) {
			legacy = append(legacy, c)
		}
	}
	byQID := map[string]ClubData{}
	for _, c := range clubs {
		byQID[c.QID] = c
	}
	canonical := canonicalClubs(clubs)
	eligible := func(q string) bool {
		c, ok := byQID[q]
		return ok && EligibleClub(c)
	}
	crest := func(q string) bool { return byQID[q].Crest }
	links := func(q string) int { return byQID[q].Sitelinks }

	cands := []candidate{}
	sorted := append([]PlayerData{}, players...)
	sort.Slice(sorted, func(i, j int) bool { return qidLess(sorted[i].QID, sorted[j].QID) })
	seen := map[string]bool{}
	for _, p := range sorted {
		if seen[p.QID] {
			continue
		}
		seen[p.QID] = true
		reject := func(reason string) { res.Rejected[reason]++ }
		if _, excluded := o.Exclude[p.QID]; excluded {
			reject("excluded after review")
			continue
		}
		if p.BirthYear < o.MinBirthYear {
			reject("born before minimum year")
			continue
		}
		stints := make([]Stint, len(p.Stints))
		for i, s := range p.Stints {
			s.Club = canonical(s.Club)
			stints[i] = s
		}
		career := Career(stints, eligible)
		if distinct(career) < 3 {
			reject("fewer than 3 dated clubs")
			continue
		}
		clues := SelectClues(career, o.MaxClues, crest, func(q string) bool { return byQID[q].SuperLig }, links)
		if distinct(clues) < 3 {
			reject("fewer than 3 distinct clues")
			continue
		}
		crests := 0
		for _, c := range clues {
			if crest(c) {
				crests++
			}
		}
		if crests < 2 {
			reject("fewer than 2 crests")
			continue
		}
		if DisplayName(p.LabelTR, p.LabelEN) == "" {
			reject("no label")
			continue
		}
		score := Score(p, career, byQID, o)
		if Bucket(score, o) == "" {
			reject("below popularity threshold")
			continue
		}
		cands = append(cands, candidate{player: p, career: career, clues: clues, score: score})
	}
	cands = uniqueNames(cands, res.Rejected)
	cands = unambiguous(cands, res.Rejected)

	slugs := assignSlugs(cands, byQID, legacy, previous)
	usedClubs := map[string]bool{}
	for _, c := range cands {
		p := c.player
		out := catalog.Player{
			ID:          p.QID,
			Name:        DisplayName(p.LabelTR, p.LabelEN),
			Difficulty:  Bucket(c.score, o),
			BirthYear:   p.BirthYear,
			Position:    Position(p.Positions),
			Nationality: p.Nationality,
			SourceURL:   "https://www.wikidata.org/wiki/" + p.QID,
		}
		for _, q := range c.clues {
			out.Clubs = append(out.Clubs, slugs[q])
			usedClubs[q] = true
		}
		res.Players = append(res.Players, out)
	}
	sort.SliceStable(res.Players, func(i, j int) bool {
		a, b := res.Players[i], res.Players[j]
		if a.Difficulty != b.Difficulty {
			return difficultyRank(a.Difficulty) < difficultyRank(b.Difficulty)
		}
		return qidLess(a.ID, b.ID)
	})
	res.Clubs = clubEntries(usedClubs, slugs, byQID, legacy)
	return res, nil
}

func difficultyRank(d string) int {
	return map[string]int{"easy": 0, "medium": 1, "hard": 2}[d]
}

func distinct(clubs []string) int {
	set := map[string]bool{}
	for _, c := range clubs {
		set[c] = true
	}
	return len(set)
}

// canonicalClubs merges Wikidata items that point at the same ESPN team
// (e.g. a multi-sport club and its football section) so dedupe and the
// ambiguity check see one club. The best-known item wins.
func canonicalClubs(clubs []ClubData) func(string) string {
	best := map[string]ClubData{}
	for _, c := range clubs {
		if c.ESPNID == "" || !EligibleClub(c) {
			continue
		}
		cur, ok := best[c.ESPNID]
		if !ok || c.Sitelinks > cur.Sitelinks || (c.Sitelinks == cur.Sitelinks && qidLess(c.QID, cur.QID)) {
			best[c.ESPNID] = c
		}
	}
	espn := map[string]string{}
	for _, c := range clubs {
		espn[c.QID] = c.ESPNID
	}
	return func(q string) string {
		if id := espn[q]; id != "" {
			if c, ok := best[id]; ok {
				return c.QID
			}
		}
		return q
	}
}

// uniqueNames keeps the more popular player when two display names fold to
// the same text; options must never show two identical names.
func uniqueNames(cands []candidate, rejected map[string]int) []candidate {
	sort.SliceStable(cands, func(i, j int) bool {
		if cands[i].score != cands[j].score {
			return cands[i].score > cands[j].score
		}
		return qidLess(cands[i].player.QID, cands[j].player.QID)
	})
	taken := map[string]bool{}
	out := cands[:0]
	for _, c := range cands {
		key := catalog.NameKey(DisplayName(c.player.LabelTR, c.player.LabelEN))
		if taken[key] {
			rejected["duplicate display name"]++
			continue
		}
		taken[key] = true
		out = append(out, c)
	}
	return out
}

// unambiguous drops a player when another kept player's career contains the
// same clue clubs in the same order: both would be correct answers.
func unambiguous(cands []candidate, rejected map[string]int) []candidate {
	out := []candidate{}
	for i, c := range cands {
		ok := true
		for j, other := range cands {
			if i != j && Subsequence(c.clues, other.career) {
				ok = false
				break
			}
		}
		if !ok {
			rejected["clues match another career"]++
			continue
		}
		out = append(out, c)
	}
	return out
}

// Subsequence reports whether clues appear in career in order.
func Subsequence(clues, career []string) bool {
	i := 0
	for _, c := range career {
		if i < len(clues) && clues[i] == c {
			i++
		}
	}
	return i == len(clues)
}

var espnFromURL = regexp.MustCompile(`/500/(\d+)\.png`)

// LegacyESPN reads the ESPN id behind an older entry's crest ("" when the
// entry has no crest).
func LegacyESPN(c catalog.Club) string {
	if m := espnFromURL.FindStringSubmatch(c.LogoSource); m != nil {
		return m[1]
	}
	return ""
}

// IsLegacy marks the hand-verified crests of 12 Oct 2026 (entries without an
// espnMatch, or already tagged legacy). They are always kept; other entries
// of a previous clubs.json only keep their ids stable.
func IsLegacy(c catalog.Club) bool {
	return (c.ESPNMatch == "" || c.ESPNMatch == "legacy") && LegacyESPN(c) != ""
}

func legacyQID(c catalog.Club) string {
	return strings.TrimPrefix(c.WikidataURL, "https://www.wikidata.org/wiki/")
}

// assignSlugs keeps legacy ids (matched by QID or ESPN id) so saved runs and
// crest URLs stay valid, and derives new ids from the English label.
func assignSlugs(cands []candidate, clubs map[string]ClubData, legacy, previous []catalog.Club) map[string]string {
	need := map[string]bool{}
	for _, c := range cands {
		for _, q := range c.clues {
			need[q] = true
		}
	}
	qids := make([]string, 0, len(need))
	for q := range need {
		qids = append(qids, q)
	}
	sort.Slice(qids, func(i, j int) bool { return qidLess(qids[i], qids[j]) })
	taken := map[string]bool{}
	for _, l := range legacy {
		taken[l.ID] = true
	}
	out := map[string]string{}
	for _, q := range qids {
		if l, ok := matchLegacy(clubs[q], legacy); ok {
			out[q] = l.ID
		}
	}
	// Ids from the previous run stay stable for the same Wikidata item.
	for _, p := range previous {
		q := legacyQID(p)
		if need[q] && out[q] == "" && !taken[p.ID] {
			out[q] = p.ID
			taken[p.ID] = true
		}
	}
	for _, q := range qids {
		if out[q] != "" {
			continue
		}
		c := clubs[q]
		base := Slug(firstNonEmpty(c.LabelEN, c.LabelTR))
		if base == "" {
			base = "club"
		}
		slug := base
		if taken[slug] {
			suffix := "-" + strings.ToLower(q)
			if len(base)+len(suffix) > 40 {
				base = strings.TrimRight(base[:40-len(suffix)], "-")
			}
			slug = base + suffix
		}
		taken[slug] = true
		out[q] = slug
	}
	return out
}

func matchLegacy(c ClubData, legacy []catalog.Club) (catalog.Club, bool) {
	for _, l := range legacy {
		if legacyQID(l) == c.QID || (c.ESPNID != "" && LegacyESPN(l) == c.ESPNID) {
			return l, true
		}
	}
	return catalog.Club{}, false
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

// clubEntries emits every legacy club (its crest keeps being served for
// saved runs) and every clue club. Legacy entries keep id, name and ESPN id.
func clubEntries(used map[string]bool, slugs map[string]string, clubs map[string]ClubData, legacy []catalog.Club) []catalog.Club {
	byID := map[string]catalog.Club{}
	for _, l := range legacy {
		l.ESPNID = LegacyESPN(l)
		l.HasCrest = l.ESPNID != ""
		l.LogoSource = CrestURL(l.ESPNID)
		if l.ESPNMatch == "" {
			l.ESPNMatch = "legacy"
		}
		byID[l.ID] = l
	}
	for q := range used {
		c := clubs[q]
		id := slugs[q]
		entry, isLegacy := byID[id]
		if !isLegacy || !entry.HasCrest {
			entry = catalog.Club{ID: id, Name: ClubName(c.LabelTR, c.LabelEN), ESPNID: c.ESPNID, ESPNMatch: c.ESPNMatch, HasCrest: c.Crest}
			if isLegacy {
				entry.Name = byID[id].Name
			}
			if c.Crest {
				entry.LogoSource = CrestURL(c.ESPNID)
			}
		}
		entry.WikidataURL = "https://www.wikidata.org/wiki/" + q
		byID[id] = entry
	}
	out := make([]catalog.Club, 0, len(byID))
	for _, c := range byID {
		out = append(out, c)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

// CrestURL is the full-size ESPN crest the asset was scaled from.
func CrestURL(espnID string) string {
	if espnID == "" {
		return ""
	}
	return "https://a.espncdn.com/i/teamlogos/soccer/500/" + espnID + ".png"
}

var slugFold = strings.NewReplacer("ı", "i", "İ", "i", "ş", "s", "Ş", "s", "ğ", "g", "Ğ", "g", "ç", "c", "Ç", "c", "ö", "o", "Ö", "o", "ü", "u", "Ü", "u", "ß", "ss", "æ", "ae", "ø", "o", "Ø", "o", "å", "a", "ł", "l", "Ł", "l", "đ", "d", "ð", "d", "þ", "th")

// Slug makes a lowercase ASCII id of at most 40 characters.
func Slug(name string) string {
	name = foldASCII(slugFold.Replace(name))
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(name) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			dash = false
		} else if !dash && b.Len() > 0 {
			b.WriteByte('-')
			dash = true
		}
	}
	s := strings.TrimRight(b.String(), "-")
	if len(s) > 40 {
		s = strings.TrimRight(s[:40], "-")
	}
	return s
}

// foldASCII strips Latin accents without x/text: accented letters map to
// their base letter; anything else non-ASCII becomes a separator.
func foldASCII(s string) string {
	const from = "àáâãäāăąèéêëēėęěìíîïīįòóôõöōőùúûüūůűųýÿñńňçćčďľĺňřŕšśşťžźżÀÁÂÃÄĀĂĄÈÉÊËĒĖĘĚÌÍÎÏĪĮÒÓÔÕÖŌŐÙÚÛÜŪŮŰŲÝŸÑŃŇÇĆČĎĽĹŘŔŠŚŞŤŽŹŻ"
	const to = "aaaaaaaaeeeeeeeeiiiiiiooooooouuuuuuuuyynnncccdllnrrsssstzzzAAAAAAAAEEEEEEEEIIIIIIOOOOOOOUUUUUUUUYYNNNCCCDLLRRSSSTZZZ"
	src := []rune(from)
	dst := []rune(to)
	m := make(map[rune]rune, len(src))
	for i, r := range src {
		m[r] = dst[i]
	}
	var b strings.Builder
	for _, r := range s {
		if r < 128 {
			b.WriteRune(r)
		} else if v, ok := m[r]; ok {
			b.WriteRune(v)
		} else {
			b.WriteRune(' ')
		}
	}
	return b.String()
}

func isQID(s string) bool {
	if len(s) < 2 || s[0] != 'Q' {
		return false
	}
	_, err := strconv.Atoi(s[1:])
	return err == nil
}

// qidLess orders Q-ids numerically so output is stable.
func qidLess(a, b string) bool {
	na, ea := strconv.Atoi(strings.TrimPrefix(a, "Q"))
	nb, eb := strconv.Atoi(strings.TrimPrefix(b, "Q"))
	if ea == nil && eb == nil && na != nb {
		return na < nb
	}
	return a < b
}

// Summary describes the pool for the command's report.
func (r Result) Summary() string {
	counts := map[string]int{}
	for _, p := range r.Players {
		counts[p.Difficulty]++
	}
	crests := 0
	for _, c := range r.Clubs {
		if c.HasCrest {
			crests++
		}
	}
	return fmt.Sprintf("players: easy=%d medium=%d hard=%d total=%d; clubs=%d with crest=%d", counts["easy"], counts["medium"], counts["hard"], len(r.Players), len(r.Clubs), crests)
}
