package build

import (
	"sort"
	"strings"
)

// ESPNTeam is a team seen in an ESPN league standings table.
type ESPNTeam struct {
	ID     string
	League string // ESPN league code, e.g. tur.1
	Names  []string
}

// ClubNames are the labels used to match a Wikidata club to ESPN.
type ClubNames struct {
	QID       string
	Countries []string // P17 QIDs
	Labels    []string // en/tr labels
	Aliases   []string // en aliases
}

// LeagueCountries maps ESPN league prefixes to Wikidata country QIDs.
var LeagueCountries = map[string][]string{
	"eng": {"Q145", "Q21"}, "sco": {"Q145", "Q22"}, "wal": {"Q145", "Q25"},
	"esp": {"Q29"}, "ita": {"Q38"}, "ger": {"Q183"}, "fra": {"Q142", "Q235"},
	"por": {"Q45"}, "ned": {"Q55"}, "bel": {"Q31"}, "tur": {"Q43"},
	"gre": {"Q41"}, "rus": {"Q159"}, "ukr": {"Q212"}, "aut": {"Q40"},
	"sui": {"Q39"}, "den": {"Q35"}, "swe": {"Q34"}, "nor": {"Q20"},
	"usa": {"Q30", "Q16"}, "mex": {"Q96"}, "bra": {"Q155"}, "arg": {"Q414"},
	"ksa": {"Q851"}, "chn": {"Q148"}, "jpn": {"Q17"}, "cyp": {"Q229"},
	"aus": {"Q408"}, "col": {"Q739"}, "uru": {"Q77"}, "chi": {"Q298"},
	"kor": {"Q884"}, "isr": {"Q801"}, "qat": {"Q846"}, "uae": {"Q878"},
	"irl": {"Q27"}, "par": {"Q733"}, "per": {"Q419"}, "ecu": {"Q736"},
}

var nameStop = map[string]bool{
	"fc": true, "cf": true, "sc": true, "ac": true, "afc": true, "as": true, "sk": true, "fk": true,
	"jk": true, "cd": true, "ud": true, "sd": true, "rc": true, "rcd": true, "ssc": true, "ss": true,
	"us": true, "sv": true, "vfb": true, "vfl": true, "bv": true, "tsg": true, "fsv": true, "club": true,
	"de": true, "del": true, "da": true, "do": true, "futbol": true, "football": true, "calcio": true,
	"kulubu": true, "sl": true, "sad": true, "sae": true, "sa": true, "cp": true, "1": true, "the": true,
	"clube": true, "and": true, "spor": true,
}

// NameKey normalizes a team name for matching: accents folded, dots
// joined (F.C. -> fc), and legal-form words dropped.
func NameKey(name string) string {
	name = foldASCII(slugFold.Replace(paren.ReplaceAllString(name, "")))
	name = strings.NewReplacer(".", "", "'", "", "’", "").Replace(strings.ToLower(name))
	fields := strings.FieldsFunc(name, func(r rune) bool {
		return (r < 'a' || r > 'z') && (r < '0' || r > '9')
	})
	out := fields[:0]
	for _, f := range fields {
		if !nameStop[f] {
			out = append(out, f)
		}
	}
	return strings.Join(out, " ")
}

// MatchESPN finds an ESPN id for each club by name in a league of the same
// country. Labels are tried first, then aliases; a club is matched only when
// exactly one ESPN team fits, so look-alike names are left without a crest.
func MatchESPN(clubs []ClubNames, teams []ESPNTeam) map[string]string {
	type key struct{ country, name string }
	index := map[key]map[string]bool{}
	for _, t := range teams {
		prefix, _, _ := strings.Cut(t.League, ".")
		for _, country := range LeagueCountries[prefix] {
			for _, n := range t.Names {
				k := key{country, NameKey(n)}
				if k.name == "" {
					continue
				}
				if index[k] == nil {
					index[k] = map[string]bool{}
				}
				index[k][t.ID] = true
			}
		}
	}
	lookup := func(c ClubNames, names []string) []string {
		ids := map[string]bool{}
		for _, country := range c.Countries {
			for _, n := range names {
				for id := range index[key{country, NameKey(n)}] {
					ids[id] = true
				}
			}
		}
		out := make([]string, 0, len(ids))
		for id := range ids {
			out = append(out, id)
		}
		sort.Strings(out)
		return out
	}
	out := map[string]string{}
	for _, c := range clubs {
		ids := lookup(c, c.Labels)
		if len(ids) == 0 {
			ids = lookup(c, c.Aliases)
		}
		if len(ids) == 1 {
			out[c.QID] = ids[0]
		}
	}
	return out
}
