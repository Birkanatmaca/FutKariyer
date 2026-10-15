package catalog

import (
	"fmt"
	"testing"
)

// validFixture is the smallest valid catalog: 7 easy, 6 medium and 6 hard
// players, each with a distinct 3-5 club sequence holding two crests.
func validFixture(t *testing.T) ([]Player, []Club, map[string]bool) {
	t.Helper()
	clubs := []Club{
		{ID: "a", Name: "A", HasCrest: true}, {ID: "b", Name: "B", HasCrest: true},
		{ID: "c", Name: "C", HasCrest: true}, {ID: "d", Name: "D"}, {ID: "club-04", Name: "Club 04"},
	}
	crests := map[string]bool{"a": true, "b": true, "c": true}
	// Every a > b > ... sequence of 3-5 clubs without adjacent repeats.
	var sequences [][]string
	var grow func([]string)
	grow = func(seq []string) {
		if len(seq) >= 3 {
			sequences = append(sequences, append([]string{}, seq...))
		}
		if len(seq) == 5 {
			return
		}
		for _, c := range clubs {
			if c.ID != seq[len(seq)-1] {
				grow(append(seq, c.ID))
			}
		}
	}
	grow([]string{"a", "b"})
	players := []Player{}
	for i := 0; i < 19; i++ {
		difficulty := "easy"
		if i >= 7 {
			difficulty = "medium"
		}
		if i >= 13 {
			difficulty = "hard"
		}
		seq := sequences[i*4]
		players = append(players, Player{
			ID: fmt.Sprintf("Q%d", i+1), Name: fmt.Sprintf("Player %d", i+1), Difficulty: difficulty,
			Clubs: seq, BirthYear: 1980 + i, Position: "forvet", SourceURL: fmt.Sprintf("https://www.wikidata.org/wiki/Q%d", i+1),
		})
	}
	return players, clubs, crests
}

func TestValidateAcceptsFixture(t *testing.T) {
	bank, err := Validate(validFixture(t))
	if err != nil {
		t.Fatal(err)
	}
	if len(bank.Players) != 19 || len(bank.Clubs) != 5 {
		t.Fatalf("bank %d/%d", len(bank.Players), len(bank.Clubs))
	}
}

func TestValidateRejectsBrokenCatalogs(t *testing.T) {
	cases := map[string]func([]Player, []Club, map[string]bool) ([]Player, []Club, map[string]bool){
		"duplicate id": func(p []Player, c []Club, cr map[string]bool) ([]Player, []Club, map[string]bool) {
			p[1].ID = p[0].ID
			return p, c, cr
		},
		"duplicate folded name": func(p []Player, c []Club, cr map[string]bool) ([]Player, []Club, map[string]bool) {
			p[0].Name, p[1].Name = "Mesut Özil", "mesut  ozil"
			return p, c, cr
		},
		"bad difficulty": func(p []Player, c []Club, cr map[string]bool) ([]Player, []Club, map[string]bool) {
			p[0].Difficulty = "legend"
			return p, c, cr
		},
		"two clubs": func(p []Player, c []Club, cr map[string]bool) ([]Player, []Club, map[string]bool) {
			p[0].Clubs = []string{"a", "b"}
			return p, c, cr
		},
		"six clubs": func(p []Player, c []Club, cr map[string]bool) ([]Player, []Club, map[string]bool) {
			p[0].Clubs = []string{"a", "b", "c", "d", "a", "b"}
			return p, c, cr
		},
		"unknown club": func(p []Player, c []Club, cr map[string]bool) ([]Player, []Club, map[string]bool) {
			p[0].Clubs = []string{"a", "b", "zz"}
			return p, c, cr
		},
		"one crest": func(p []Player, c []Club, cr map[string]bool) ([]Player, []Club, map[string]bool) {
			p[0].Clubs = []string{"a", "d", "club-04"}
			return p, c, cr
		},
		"shared clues": func(p []Player, c []Club, cr map[string]bool) ([]Player, []Club, map[string]bool) {
			p[1].Clubs = append([]string{}, p[0].Clubs...)
			return p, c, cr
		},
		"crest flag without file": func(p []Player, c []Club, cr map[string]bool) ([]Player, []Club, map[string]bool) {
			delete(cr, "a")
			return p, c, cr
		},
		"file without flag": func(p []Player, c []Club, cr map[string]bool) ([]Player, []Club, map[string]bool) {
			cr["d"] = true
			return p, c, cr
		},
		"orphan crest": func(p []Player, c []Club, cr map[string]bool) ([]Player, []Club, map[string]bool) {
			cr["ghost"] = true
			return p, c, cr
		},
		"bad club id": func(p []Player, c []Club, cr map[string]bool) ([]Player, []Club, map[string]bool) {
			c = append(c, Club{ID: "Bad/ID", Name: "x"})
			return p, c, cr
		},
		"bad position": func(p []Player, c []Club, cr map[string]bool) ([]Player, []Club, map[string]bool) {
			p[0].Position = "striker"
			return p, c, cr
		},
		"too few hard": func(p []Player, c []Club, cr map[string]bool) ([]Player, []Club, map[string]bool) {
			return p[:len(p)-1], c, cr
		},
	}
	for name, mutate := range cases {
		players, clubs, crests := validFixture(t)
		if _, err := Validate(mutate(players, clubs, crests)); err == nil {
			t.Errorf("%s accepted", name)
		}
	}
}

// The user decision of 14 Oct 2026 asks for a large pool; keep it large.
func TestEmbeddedCatalogIsLargeAndValid(t *testing.T) {
	bank, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	counts := map[string]int{}
	for _, p := range bank.Players {
		counts[p.Difficulty]++
	}
	if counts["easy"] < 150 || counts["medium"] < 200 || counts["hard"] < 250 {
		t.Fatalf("pool too small: %v", counts)
	}
	for _, legacy := range []string{"barcelona", "real-madrid", "galatasaray", "besiktas", "man-united", "inter-miami", "santos", "fulham"} {
		if c, ok := bank.Clubs[legacy]; !ok || !c.HasCrest || !HasCrest(legacy) {
			t.Errorf("legacy crest %s missing", legacy)
		}
	}
	if _, err := Logo("../clubs"); err == nil {
		t.Fatal("path traversal served")
	}
}
