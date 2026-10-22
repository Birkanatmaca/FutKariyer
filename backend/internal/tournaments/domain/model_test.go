package domain

import (
	"fmt"
	"testing"
)

func TestRoundRobinPairsEveryTeamOncePerLeg(t *testing.T) {
	for n := 2; n <= 9; n++ {
		teams := make([]string, n)
		for i := range teams {
			teams[i] = fmt.Sprint("t", i)
		}
		for _, legs := range []int{1, 2} {
			fixture := RoundRobin(teams, legs)
			if want := n * (n - 1) / 2 * legs; len(fixture) != want {
				t.Fatalf("n=%d legs=%d: %d matches, want %d", n, legs, len(fixture), want)
			}
			meetings := map[[2]string]int{}
			perRound := map[int]map[string]bool{}
			home := map[string]int{}
			for _, p := range fixture {
				if p.Home == p.Away || p.Home == "" || p.Away == "" {
					t.Fatalf("bad pairing %+v", p)
				}
				if perRound[p.Round] == nil {
					perRound[p.Round] = map[string]bool{}
				}
				if perRound[p.Round][p.Home] || perRound[p.Round][p.Away] {
					t.Fatalf("n=%d: a team plays twice in round %d", n, p.Round)
				}
				perRound[p.Round][p.Home], perRound[p.Round][p.Away] = true, true
				meetings[[2]string{p.Home, p.Away}]++
				home[p.Home]++
			}
			for i := range teams {
				for j := range teams {
					if i >= j {
						continue
					}
					a, b := teams[i], teams[j]
					total := meetings[[2]string{a, b}] + meetings[[2]string{b, a}]
					if total != legs {
						t.Fatalf("n=%d legs=%d: %s-%s meet %d times", n, legs, a, b, total)
					}
					if legs == 2 && (meetings[[2]string{a, b}] != 1 || meetings[[2]string{b, a}] != 1) {
						t.Fatalf("n=%d: %s-%s should host once each", n, a, b)
					}
				}
			}
			if legs == 1 && n%2 == 0 {
				for team, games := range home {
					if games < (n-1)/2-1 || games > n/2+1 {
						t.Fatalf("n=%d: %s hosts %d of %d", n, team, games, n-1)
					}
				}
			}
		}
	}
	if RoundRobin([]string{"a"}, 1) != nil {
		t.Fatal("one team cannot have a fixture")
	}
}
