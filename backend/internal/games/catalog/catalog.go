// Package catalog holds the Arma İzi player pool. questions.json, clubs.json
// and assets/ are produced offline by cmd/gamecatalog from Wikidata (CC0) and
// ESPN crests; the API only reads the embedded copy.
package catalog

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"regexp"
	"strings"

	"futcareer/backend/internal/games/domain"
)

//go:embed questions.json clubs.json assets/*.png
var files embed.FS

// Player is one question: the clubs are chronological clue stops; options
// are drawn from the same difficulty bucket when a run starts.
type Player struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Difficulty  string   `json:"difficulty"`
	Clubs       []string `json:"clubs"`
	BirthYear   int      `json:"birthYear"`
	Position    string   `json:"position,omitempty"`
	Nationality string   `json:"nationality,omitempty"`
	SourceURL   string   `json:"sourceUrl"`
}

// Club is a clue club. HasCrest must match assets/{id}.png.
type Club struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	ESPNID      string `json:"espnId,omitempty"`
	HasCrest    bool   `json:"hasCrest"`
	WikidataURL string `json:"wikidataUrl,omitempty"`
	LogoSource  string `json:"logoSource,omitempty"`
	// ESPNMatch records how espnId was found: wikidata (P13590),
	// espn-standings (unique name match in the same country) or legacy.
	ESPNMatch string `json:"espnMatch,omitempty"`
}

type Bank struct {
	Players []Player
	Clubs   map[string]Club
}

// Positions are the coarse Turkish position labels the generator emits.
var Positions = map[string]bool{"kaleci": true, "defans": true, "orta saha": true, "forvet": true}

// MinPool is the smallest bucket that still forms a run: the questions it
// needs plus three distractors.
func MinPool(difficulty string) int {
	for _, step := range domain.DifficultyPlan {
		if step.Difficulty == difficulty {
			return step.Count + 3
		}
	}
	return 0
}

var clubID = regexp.MustCompile(`^[a-z0-9-]{1,40}$`)

// Load reads and validates the embedded catalog.
func Load() (Bank, error) {
	return LoadFS(files)
}

// LoadFS reads a catalog laid out like the embedded one.
func LoadFS(fsys fs.FS) (Bank, error) {
	var players []Player
	var clubs []Club
	data, err := fs.ReadFile(fsys, "questions.json")
	if err != nil {
		return Bank{}, err
	}
	if err = json.Unmarshal(data, &players); err != nil {
		return Bank{}, err
	}
	if data, err = fs.ReadFile(fsys, "clubs.json"); err != nil {
		return Bank{}, err
	}
	if err = json.Unmarshal(data, &clubs); err != nil {
		return Bank{}, err
	}
	crests := map[string]bool{}
	entries, err := fs.ReadDir(fsys, "assets")
	if err != nil {
		return Bank{}, err
	}
	for _, e := range entries {
		if name, ok := strings.CutSuffix(e.Name(), ".png"); ok && !e.IsDir() {
			crests[name] = true
		}
	}
	return Validate(players, clubs, crests)
}

// Validate checks the shape a run relies on: unique ids and names, valid
// buckets with enough players, 3-5 known clubs per question (two with
// crests), no two players sharing a clue sequence and crest files that match
// the clubs claiming them.
func Validate(players []Player, clubs []Club, crests map[string]bool) (Bank, error) {
	b := Bank{Players: players, Clubs: map[string]Club{}}
	for _, c := range clubs {
		if !clubID.MatchString(c.ID) || strings.TrimSpace(c.Name) == "" {
			return b, fmt.Errorf("invalid game club %q", c.ID)
		}
		if _, dup := b.Clubs[c.ID]; dup {
			return b, fmt.Errorf("duplicate game club %s", c.ID)
		}
		if c.HasCrest != crests[c.ID] {
			return b, fmt.Errorf("game club %s crest flag does not match assets", c.ID)
		}
		b.Clubs[c.ID] = c
	}
	for id := range crests {
		if _, ok := b.Clubs[id]; !ok {
			return b, fmt.Errorf("crest %s has no club", id)
		}
	}
	counts := map[string]int{}
	ids := map[string]bool{}
	names := map[string]bool{}
	sequences := map[string]string{}
	for _, p := range players {
		if p.ID == "" || ids[p.ID] {
			return b, fmt.Errorf("invalid or duplicate game question %q", p.ID)
		}
		ids[p.ID] = true
		if MinPool(p.Difficulty) == 0 {
			return b, fmt.Errorf("invalid difficulty for %s", p.ID)
		}
		name := NameKey(p.Name)
		if name == "" || names[name] {
			return b, fmt.Errorf("empty or duplicate player name %q", p.Name)
		}
		names[name] = true
		if len(p.Clubs) < 3 || len(p.Clubs) > 5 {
			return b, fmt.Errorf("game question %s needs 3-5 clubs", p.ID)
		}
		withCrest := 0
		for i, id := range p.Clubs {
			c, ok := b.Clubs[id]
			if !ok {
				return b, fmt.Errorf("unknown game club %s in %s", id, p.ID)
			}
			if i > 0 && p.Clubs[i-1] == id {
				return b, fmt.Errorf("repeated consecutive club in %s", p.ID)
			}
			if c.HasCrest {
				withCrest++
			}
		}
		if withCrest < 2 {
			return b, fmt.Errorf("game question %s needs two crests", p.ID)
		}
		seq := strings.Join(p.Clubs, ">")
		if other, dup := sequences[seq]; dup {
			return b, fmt.Errorf("game questions %s and %s share clues", other, p.ID)
		}
		sequences[seq] = p.ID
		if p.BirthYear < 1900 || p.BirthYear > 2100 || (p.Position != "" && !Positions[p.Position]) || !strings.HasPrefix(p.SourceURL, "https://") {
			return b, fmt.Errorf("invalid game question metadata %s", p.ID)
		}
		counts[p.Difficulty]++
	}
	for _, step := range domain.DifficultyPlan {
		if counts[step.Difficulty] < MinPool(step.Difficulty) {
			return b, fmt.Errorf("insufficient %s football game questions", step.Difficulty)
		}
	}
	return b, nil
}

var nameFold = strings.NewReplacer("ı", "i", "İ", "i", "ş", "s", "Ş", "s", "ğ", "g", "Ğ", "g", "ç", "c", "Ç", "c", "ö", "o", "Ö", "o", "ü", "u", "Ü", "u", "é", "e", "è", "e", "á", "a", "à", "a", "ã", "a", "í", "i", "ó", "o", "ú", "u", "ñ", "n", "ć", "c", "č", "c", "š", "s", "ž", "z", "ø", "o", "å", "a", "ä", "a", "ë", "e", "ï", "i")

// NameKey folds case and common diacritics so look-alike names count as one.
func NameKey(name string) string {
	return strings.Join(strings.Fields(strings.ToLower(nameFold.Replace(name))), " ")
}

// Logo serves only crest files bundled in this immutable bank.
func Logo(id string) ([]byte, error) {
	if !clubID.MatchString(id) {
		return nil, domain.ErrNotFound
	}
	data, err := files.ReadFile("assets/" + id + ".png")
	if err != nil {
		return nil, domain.ErrNotFound
	}
	return data, nil
}

// HasCrest reports whether a crest is bundled for the club id. Runs saved
// before a catalog update are rendered with the current answer.
func HasCrest(id string) bool {
	if !clubID.MatchString(id) {
		return false
	}
	_, err := fs.Stat(files, "assets/"+id+".png")
	return err == nil
}
