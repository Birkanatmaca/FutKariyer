package application

import (
	"context"
	"testing"

	footballdomain "futcareer/backend/internal/football/domain"
)

type recordingStandings struct{ slugs []string }

func (r *recordingStandings) Standings(_ context.Context, slug string) (footballdomain.Standings, error) {
	r.slugs = append(r.slugs, slug)
	return footballdomain.Standings{}, footballdomain.ErrUpstream
}

// Kafa Kafaya compares clubs of the six domestic leagues only; the UEFA cups
// in the Ligler catalog must never become a round.
func TestHeadToHeadNeverPicksACup(t *testing.T) {
	cups := map[string]bool{}
	for _, c := range footballdomain.Cups {
		cups[c.Slug] = true
	}
	for i := 0; i < 20; i++ {
		source := &recordingStandings{}
		s := &Service{standings: source}
		if _, _, err := s.h2hLeague(context.Background()); err == nil {
			t.Fatal("every league failed, an error was expected")
		}
		if len(source.slugs) != len(footballdomain.Competitions) {
			t.Fatalf("tried %v", source.slugs)
		}
		for _, slug := range source.slugs {
			if cups[slug] {
				t.Fatalf("cup %s used for Kafa Kafaya", slug)
			}
		}
	}
}
