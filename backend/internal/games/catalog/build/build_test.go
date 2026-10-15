package build

import (
	"reflect"
	"strings"
	"testing"

	"futcareer/backend/internal/games/catalog"
)

func club(qid, en string) ClubData {
	return ClubData{QID: qid, LabelEN: en, SportsTeam: true, Sitelinks: 50, Crest: true, ESPNID: strings.TrimPrefix(qid, "Q")}
}

func TestEligibleClubRejectsNationalYouthReserveAndWomenTeams(t *testing.T) {
	cases := map[string]ClubData{
		"national flag":    {QID: "Q1", LabelEN: "Portugal", National: true, SportsTeam: true},
		"reserve flag":     {QID: "Q2", LabelEN: "Something", Reserve: true, SportsTeam: true},
		"youth flag":       {QID: "Q3", LabelEN: "Academy X", Youth: true, SportsTeam: true},
		"women flag":       {QID: "Q4", LabelEN: "Arsenal", Women: true, SportsTeam: true},
		"not a team":       {QID: "Q5", LabelEN: "Barcelona", SportsTeam: false},
		"B team":           club("Q6", "FC Barcelona B"),
		"II team":          club("Q7", "FC Bayern Munich II"),
		"U-19":             club("Q8", "Ajax U19"),
		"under-21":         club("Q9", "Chelsea F.C. Under-21s"),
		"Castilla":         club("Q10", "Real Madrid Castilla"),
		"Jong":             club("Q11", "Jong PSV"),
		"Primavera":        club("Q12", "Inter Primavera"),
		"Atlètic":          club("Q13", "FC Barcelona Atlètic"),
		"Sevilla Atlético": club("Q14", "Sevilla Atlético"),
		"Next Gen":         club("Q15", "Juventus Next Gen"),
		"national name":    club("Q16", "Turkey national under-21 football team"),
		"olympic":          club("Q17", "Brazil Olympic football team"),
		"turkish youth":    {QID: "Q18", LabelTR: "Galatasaray Altyapı", SportsTeam: true},
		"women name":       club("Q19", "Juventus Women"),
	}
	for name, c := range cases {
		if EligibleClub(c) {
			t.Errorf("%s: %q accepted", name, c.LabelEN+c.LabelTR)
		}
	}
	for _, name := range []string{"Atlético Madrid", "Club Brugge KV", "Sporting CP", "Beşiktaş J.K.", "FC Schalke 04", "Hannover 96", "Athletic Bilbao", "Club Atlético Boca Juniors"} {
		c := club("Q99", name)
		if !EligibleClub(c) {
			t.Errorf("%q rejected", name)
		}
	}
}

func TestCareerOrdersByStartDropsUndatedAndMergesRepeats(t *testing.T) {
	ok := func(q string) bool { return q != "QNAT" }
	stints := []Stint{
		{Club: "QREAL", Start: "2009-07-01", End: "2018-07-01"},
		{Club: "QSPORT", Start: "2002-01-01", End: "2003-01-01"},
		{Club: "QNAT", Start: "2003-01-01"},
		{Club: "QMANU", Start: "2003-08-12", End: "2009-07-01"},
		{Club: "QMANU", Start: "2021-08-31", End: "2022-11-22"},
		{Club: "QJUVE", Start: "2018-07-10", End: "2021-08-31"},
		{Club: "QNASSR", Start: "2023-01-01"},
		{Club: "QUNDATED"},
		{Club: "QREAL", Start: "2010-01-01", End: "2011-01-01"}, // overlapping duplicate
	}
	got := Career(stints, ok)
	want := []string{"QSPORT", "QMANU", "QREAL", "QJUVE", "QMANU", "QNASSR"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("career %v, want %v", got, want)
	}
	// A loan inside a longer spell returns to the parent club afterwards.
	henry := Career([]Stint{
		{Club: "QARS", Start: "1999-08-03", End: "2007-06-25"},
		{Club: "QBAR", Start: "2007-06-25", End: "2010-07-14"},
		{Club: "QNYRB", Start: "2010-07-14", End: "2014-12-16"},
		{Club: "QARS", Start: "2012-01-06", End: "2012-02-17"},
	}, ok)
	if !reflect.DeepEqual(henry, []string{"QARS", "QBAR", "QNYRB", "QARS", "QNYRB"}) {
		t.Fatalf("loan return %v", henry)
	}
	// A loan away and back is three stops; same-year starts order by end.
	loan := Career([]Stint{
		{Club: "QA", Start: "2010-01-01", End: "2014-01-01"},
		{Club: "QB", Start: "2010-01-01", End: "2011-01-01"},
		{Club: "QA", Start: "2011-01-01", End: "2014-01-01"},
	}, ok)
	if !reflect.DeepEqual(loan, []string{"QB", "QA"}) {
		t.Fatalf("loan ordering %v", loan)
	}
}

func TestSelectCluesKeepsEndsAndPrefersCrestedDistinctKnownClubs(t *testing.T) {
	crest := map[string]bool{"A": true, "C": true, "D": true, "F": true, "G": false}
	links := map[string]int{"B": 10, "C": 40, "D": 90, "E": 200, "F": 30}
	career := []string{"A", "B", "C", "D", "E", "F", "A", "G"}
	none := func(string) bool { return false }
	got := SelectClues(career, 5, func(q string) bool { return crest[q] }, none, func(q string) int { return links[q] })
	want := []string{"A", "C", "D", "F", "G"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("clues %v, want %v", got, want)
	}
	// Among equal crests a Süper Lig stop beats a better-known club.
	four := SelectClues(career, 4, func(q string) bool { return crest[q] }, none, func(q string) int { return links[q] })
	if !reflect.DeepEqual(four, []string{"A", "C", "D", "G"}) {
		t.Fatalf("four clues %v", four)
	}
	turkish := SelectClues(career, 4, func(q string) bool { return crest[q] }, func(q string) bool { return q == "F" }, func(q string) int { return links[q] })
	if !reflect.DeepEqual(turkish, []string{"A", "D", "F", "G"}) {
		t.Fatalf("süper lig clues %v", turkish)
	}
	short := SelectClues([]string{"A", "B", "C"}, 5, none, none, func(string) int { return 0 })
	if !reflect.DeepEqual(short, []string{"A", "B", "C"}) {
		t.Fatalf("short career must be kept whole: %v", short)
	}
}

func TestBucketAndSuperLigBonus(t *testing.T) {
	o := Options{EasyMin: 70, MediumMin: 50, HardMin: 30, SuperLigBonus: 12}
	for score, want := range map[int]string{90: "easy", 70: "easy", 69: "medium", 50: "medium", 49: "hard", 30: "hard", 29: ""} {
		if got := Bucket(score, o); got != want {
			t.Errorf("Bucket(%d)=%q want %q", score, got, want)
		}
	}
	clubs := map[string]ClubData{"GS": {QID: "GS", SuperLig: true}, "X": {QID: "X"}}
	p := PlayerData{Sitelinks: 45}
	if Score(p, []string{"X", "GS"}, clubs, o) != 57 || Score(p, []string{"X"}, clubs, o) != 45 {
		t.Fatal("Süper Lig bonus is applied once and only for Süper Lig careers")
	}
	if Bucket(Score(p, []string{"GS"}, clubs, o), o) != "medium" {
		t.Fatal("bonus should lift a Süper Lig player into medium")
	}
}

func TestBuildAppliesRulesAndRejectsAmbiguousClues(t *testing.T) {
	clubs := []ClubData{
		club("Q1", "Sporting CP"), club("Q2", "Manchester United F.C."), club("Q3", "Real Madrid CF"),
		club("Q4", "Juventus FC"), club("Q5", "Galatasaray S.K."),
		{QID: "Q6", LabelEN: "Portugal national football team", National: true, SportsTeam: true},
		{QID: "Q7", LabelEN: "Small Town FC", SportsTeam: true, Sitelinks: 3},
		{QID: "Q8", LabelEN: "Galatasaray (multi-sport)", LabelTR: "Galatasaray", SportsTeam: true, ESPNID: "5", Sitelinks: 10},
		{QID: "Q9", LabelEN: "Other Town FC", SportsTeam: true, Sitelinks: 2},
	}
	clubs[4].SuperLig = true
	clubs[4].LabelTR = "Galatasaray SK"
	stint := func(c, start string) Stint { return Stint{Club: c, Start: start} }
	players := []PlayerData{
		{QID: "Q100", LabelEN: "Cristiano Ronaldo", BirthYear: 1985, Sitelinks: 300, Positions: []string{"forvet"},
			Stints: []Stint{stint("Q1", "2002"), stint("Q6", "2003"), stint("Q2", "2003-08"), stint("Q3", "2009"), stint("Q4", "2018")}},
		// Clues Q1 > Q2 > Q3 also appear in order in Q100's career.
		{QID: "Q101", LabelEN: "Copycat", BirthYear: 1990, Sitelinks: 300, Stints: []Stint{stint("Q1", "2008"), stint("Q2", "2010"), stint("Q3", "2012")}},
		{QID: "Q102", LabelEN: "Too Old", BirthYear: 1960, Sitelinks: 300, Stints: []Stint{stint("Q1", "1980"), stint("Q2", "1985"), stint("Q4", "1990")}},
		{QID: "Q103", LabelEN: "Few Crests", BirthYear: 1990, Sitelinks: 300, Stints: []Stint{stint("Q7", "2008"), stint("Q6", "2009"), stint("Q4", "2010"), stint("Q9", "2012")}},
		// The multi-sport item merges into the football club by ESPN id,
		// so Galatasaray -> Galatasaray collapses and only 2 clubs remain.
		{QID: "Q104", LabelEN: "Merged", BirthYear: 1990, Sitelinks: 300, Stints: []Stint{stint("Q4", "2008"), stint("Q5", "2010"), stint("Q8", "2011")}},
		{QID: "Q105", LabelEN: "Turkish Star", LabelTR: "Türk Yıldız (futbolcu)", BirthYear: 1992, Sitelinks: 40, Positions: []string{"defans", "orta saha", "orta saha"},
			Stints: []Stint{stint("Q5", "2010"), stint("Q4", "2014"), stint("Q3", "2016")}},
		{QID: "Q106", LabelEN: "cristiano  RONALDO", BirthYear: 1990, Sitelinks: 100, Stints: []Stint{stint("Q4", "2010"), stint("Q3", "2011"), stint("Q5", "2013")}},
	}
	legacy := []catalog.Club{{ID: "real-madrid", Name: "Real Madrid", LogoSource: "https://a.espncdn.com/i/teamlogos/soccer/500/3.png"}}
	players = append(players, PlayerData{QID: "Q107", LabelEN: "Bad Source", BirthYear: 1990, Sitelinks: 300, Stints: []Stint{stint("Q2", "2010"), stint("Q4", "2011"), stint("Q1", "2013")}})
	res, err := Build(players, clubs, legacy, Options{MinBirthYear: 1965, EasyMin: 200, MediumMin: 50, HardMin: 30, SuperLigBonus: 12, MaxClues: 5, Exclude: map[string]string{"Q107": "wrong career"}})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Players) != 2 {
		t.Fatalf("players %+v rejected %v", res.Players, res.Rejected)
	}
	ronaldo, turk := res.Players[0], res.Players[1]
	if ronaldo.ID != "Q100" || ronaldo.Difficulty != "easy" || ronaldo.Position != "forvet" || ronaldo.SourceURL != "https://www.wikidata.org/wiki/Q100" {
		t.Fatalf("ronaldo %+v", ronaldo)
	}
	if !reflect.DeepEqual(ronaldo.Clubs, []string{"sporting-cp", "manchester-united-f-c", "real-madrid", "juventus-fc"}) {
		t.Fatalf("ronaldo clues %v", ronaldo.Clubs)
	}
	if turk.Name != "Türk Yıldız" || turk.Difficulty != "medium" || turk.Position != "orta saha" {
		t.Fatalf("turkish player %+v", turk)
	}
	for _, reason := range []string{"clues match another career", "born before minimum year", "fewer than 2 crests", "fewer than 3 dated clubs", "duplicate display name", "excluded after review"} {
		if res.Rejected[reason] != 1 {
			t.Errorf("reason %q count %d (%v)", reason, res.Rejected[reason], res.Rejected)
		}
	}
	names := map[string]catalog.Club{}
	for _, c := range res.Clubs {
		names[c.ID] = c
	}
	if c := names["real-madrid"]; c.Name != "Real Madrid" || c.WikidataURL != "https://www.wikidata.org/wiki/Q3" || !c.HasCrest {
		t.Fatalf("legacy club must keep id/name: %+v", c)
	}
	if c := names["galatasaray-s-k"]; c.Name != "Galatasaray SK" || c.LogoSource != CrestURL("5") {
		t.Fatalf("new club %+v", c)
	}
	crests := map[string]bool{}
	for _, c := range res.Clubs {
		crests[c.ID] = c.HasCrest
	}
	// Two extra fillers so every bucket reaches catalog.MinPool.
	if _, err := catalog.Validate(res.Players, res.Clubs, crests); err == nil || !strings.Contains(err.Error(), "insufficient") {
		t.Fatalf("only pool size may fail validation here: %v", err)
	}
}

func TestSlugNamesAndPosition(t *testing.T) {
	for in, want := range map[string]string{
		"Beşiktaş J.K.":                 "besiktas-j-k",
		"FC Bayern München":             "fc-bayern-munchen",
		"İstanbul Başakşehir":           "istanbul-basaksehir",
		"Atlético de Madrid":            "atletico-de-madrid",
		strings.Repeat("Long Name ", 8): "long-name-long-name-long-name-long-name",
	} {
		if got := Slug(in); got != want {
			t.Errorf("Slug(%q)=%q want %q", in, got, want)
		}
	}
	if DisplayName("", "Neymar (footballer)") != "Neymar" || DisplayName("Q123", "Q123") != "" {
		t.Fatal("display name")
	}
	if ClubName("Los Angeles FC", "x") != "Los Angeles FC" || ClubName("", "Galatasaray S.K. (football)") != "Galatasaray S.K." {
		t.Fatal("club names keep legal forms and drop notes")
	}
	if Position(nil) != "" || Position([]string{"forvet", "kaleci"}) != "kaleci" {
		t.Fatal("position tie-break")
	}
	if !Subsequence([]string{"a", "c"}, []string{"a", "b", "c"}) || Subsequence([]string{"c", "a"}, []string{"a", "b", "c"}) {
		t.Fatal("subsequence")
	}
}

func TestMatchESPNNeedsSameCountryAndAUniqueTeam(t *testing.T) {
	teams := []ESPNTeam{
		{ID: "83", League: "esp.1", Names: []string{"Barcelona"}},
		{ID: "432", League: "tur.1", Names: []string{"Galatasaray"}},
		{ID: "110", League: "ita.1", Names: []string{"Internazionale"}},
		{ID: "2250", League: "por.1", Names: []string{"Sporting CP"}},
		{ID: "3788", League: "esp.2", Names: []string{"Sporting Gijón"}},
		{ID: "1", League: "eng.1", Names: []string{"Queens Park Rangers"}},
		{ID: "2", League: "sco.1", Names: []string{"Rangers"}},
	}
	clubs := []ClubNames{
		{QID: "QB", Countries: []string{"Q29"}, Labels: []string{"FC Barcelona"}},
		{QID: "QBW", Countries: []string{"Q142"}, Labels: []string{"Barcelona"}}, // wrong country
		{QID: "QGS", Countries: []string{"Q43"}, Labels: []string{"Galatasaray S.K."}},
		{QID: "QI", Countries: []string{"Q38"}, Labels: []string{"Inter Milan"}, Aliases: []string{"Internazionale", "FC Internazionale Milano"}},
		{QID: "QS", Countries: []string{"Q45"}, Labels: []string{"Sporting Clube de Portugal"}, Aliases: []string{"Sporting CP"}},
		{QID: "QQ", Countries: []string{"Q145"}, Labels: []string{"QPR"}, Aliases: []string{"Rangers", "Queens Park Rangers"}},
	}
	got := MatchESPN(clubs, teams)
	want := map[string]string{"QB": "83", "QGS": "432", "QI": "110", "QS": "2250"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("matches %v want %v", got, want)
	}
}
