package application

import (
	"context"
	"errors"
	"testing"
	"time"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/clubs/domain"
	footballdomain "futcareer/backend/internal/football/domain"
)

func goal(n int) *int { return &n }

// The shape of sistem.tffankara.org/home/puanfikstur on 20 Oct 2026: played
// weeks, a bye week with a placeholder score and weeks without a date.
var ankaraTable = footballdomain.AnkaraTable{
	Seasons: []footballdomain.Option{{ID: "20", Name: "2026-2027 Sezonu", Selected: true}},
	Leagues: []footballdomain.Option{{ID: "1166", Name: "U14 Ligi", Selected: true}},
	Groups:  []footballdomain.Option{{ID: "0", Name: "Grup yok"}, {ID: "1289", Name: "1. GRUP", Selected: true}},
	Standings: []footballdomain.StandingRow{
		{Rank: 1, Team: footballdomain.Team{Name: "MAMAK BELEDİYESİ SPOR"}, Played: 5, Won: 5, GoalDiff: 17, Points: 15},
		{Rank: 2, Team: footballdomain.Team{Name: "BARIŞSPOR"}, Played: 5, Won: 4, Lost: 1, GoalDiff: 26, Points: 12},
		{Rank: 3, Team: footballdomain.Team{Name: "ÇUBUK SPOR 1959"}, Played: 5, Won: 4, Lost: 1, GoalDiff: 16, Points: 12},
	},
	Weeks: []footballdomain.AnkaraWeek{
		{Number: 7, Matches: []footballdomain.AnkaraMatch{{Date: "TARİHİ BELİRLENMEDİ", Time: "Saati belirlenmedi", Venue: "SAHA BELİRSİZ", Home: "BARIŞSPOR", Away: "YENİMAHALLE BLD."}}},
		{Number: 5, Matches: []footballdomain.AnkaraMatch{
			{Date: "10 Ekim 2026 Cumartesi", Time: "10:00", Venue: "MAMAK ŞEHİR STADI", Home: "MAMAK BELEDİYESİ SPOR", Away: "BARIŞSPOR", HomeGoals: goal(2), AwayGoals: goal(1), Status: "MS"},
			{Date: "10 Ekim 2026 Cumartesi", Time: "12:00", Home: "ÇUBUK SPOR 1959", Away: "BALA BLD.SPOR", HomeGoals: goal(3), AwayGoals: goal(0)},
		}},
		{Number: 6, Matches: []footballdomain.AnkaraMatch{{Date: "30 Ekim 2026 Cuma", Time: "00:00", Home: "BARIŞSPOR", Away: "BAY", HomeGoals: goal(0), AwayGoals: goal(0), Status: "MS"}}},
		{Number: 4, Matches: []footballdomain.AnkaraMatch{{Date: "6 Ekim 2026 Salı", Time: "10:00", Venue: "ANITTEPE AVNİ BULDUK SAHA", Home: "BARIŞSPOR", Away: "1910 İMALATI HARBİYE SPOR", HomeGoals: goal(5), AwayGoals: goal(1)}}},
		{Number: 8, Matches: []footballdomain.AnkaraMatch{{Date: "7 Kasım 2026 Cumartesi", Time: "Saati belirlenmedi", Home: "ÇUBUK SPOR 1959", Away: "BARIŞSPOR"}}},
	},
}

func TestTFFViewReadsTableAndFixtureFromTheClubsSide(t *testing.T) {
	view, ok := tffView(ankaraTable, domain.TFFLink{Season: "20", League: "1166", Group: "1289", Team: "BARIŞSPOR"})
	if !ok {
		t.Fatal("linked team must be found in the standings")
	}
	if view.Source != "tff" || view.LeagueName != "U14 Ligi · 1. GRUP" || view.Season != "2026-2027" || view.Position != 2 || view.Points != 12 || view.TeamCount != 3 {
		t.Fatalf("league: %+v", view)
	}
	if len(view.Standings) != 3 || !view.Standings[1].Own || view.Standings[0].Own {
		t.Fatalf("standings must mark only the club's row: %+v", view.Standings)
	}
	if len(view.Recent) != 2 || view.Recent[0].Round != 4 || view.Recent[1].Round != 5 {
		t.Fatalf("recent must be oldest first without the bye: %+v", view.Recent)
	}
	last := view.Recent[1]
	if last.IsHome || last.OpponentName != "MAMAK BELEDİYESİ SPOR" || *last.GoalsFor != 1 || *last.GoalsAgainst != 2 || last.Result != "loss" || last.Venue != "MAMAK ŞEHİR STADI" {
		t.Fatalf("last match from the away side: %+v", last)
	}
	if want := time.Date(2026, 10, 10, 7, 0, 0, 0, time.UTC); last.KickoffAt == nil || !last.KickoffAt.Equal(want) || last.DateOnly {
		t.Fatalf("kickoff must be 10:00 Türkiye time: %v", last.KickoffAt)
	}
	if len(view.Upcoming) != 2 || view.Upcoming[0].Round != 7 || view.Upcoming[0].KickoffAt != nil || view.Upcoming[0].Venue != "" {
		t.Fatalf("next match has no date or venue yet: %+v", view.Upcoming)
	}
	if next := view.Upcoming[1]; next.KickoffAt == nil || !next.DateOnly || next.IsHome {
		t.Fatalf("a day without a time is date-only: %+v", next)
	}
	if _, ok := tffView(ankaraTable, domain.TFFLink{Team: "BAŞKA SPOR"}); ok {
		t.Fatal("a team missing from the table gives no view")
	}
}

func TestKickoffParsesTurkishAndNumericDates(t *testing.T) {
	for _, tc := range []struct {
		date, clock string
		want        time.Time
		dateOnly    bool
	}{
		{"19 Eylül 2026 Cumartesi", "12:00", time.Date(2026, 9, 19, 9, 0, 0, 0, time.UTC), false},
		{"1 ŞUBAT 2027 Pazartesi", "", time.Date(2027, 1, 31, 21, 0, 0, 0, time.UTC), true},
		{"3 Mayıs 2027", "18.30", time.Date(2027, 5, 3, 15, 30, 0, 0, time.UTC), false},
		{"21.11.2026", "13:00", time.Date(2026, 11, 21, 10, 0, 0, 0, time.UTC), false},
	} {
		got, dateOnly := kickoff(tc.date, tc.clock)
		if got == nil || !got.Equal(tc.want) || dateOnly != tc.dateOnly {
			t.Fatalf("%q %q: got %v dateOnly=%v", tc.date, tc.clock, got, dateOnly)
		}
	}
	for _, date := range []string{"TARİHİ BELİRLENMEDİ", "31 Şubat 2027", "", "12 Foo 2026"} {
		if got, _ := kickoff(date, "12:00"); got != nil {
			t.Fatalf("%q must not parse: %v", date, got)
		}
	}
}

type tffRepo struct {
	Repository
	saved *domain.TFFLink
}

func (r *tffRepo) SetTFF(_ context.Context, _ string, link *domain.TFFLink) (domain.Profile, error) {
	r.saved = link
	return domain.Profile{TFF: link}, nil
}

type tffSource struct {
	table footballdomain.AnkaraTable
	err   error
}

func (s tffSource) Ankara(context.Context, string, string, string) (footballdomain.AnkaraTable, error) {
	return s.table, s.err
}

func TestSetTFFAcceptsOnlyTeamsInTheChosenGroup(t *testing.T) {
	ctx := context.Background()
	repo := &tffRepo{}
	svc := New(repo, nil, tffSource{table: ankaraTable})
	var fields auth.ValidationError
	if _, err := svc.SetTFF(ctx, "club", TFFInput{Season: "x", League: "1166", Team: "BARIŞSPOR"}); !errors.As(err, &fields) || fields["season"] == "" {
		t.Fatalf("season must be an id: %v", err)
	}
	if _, err := svc.SetTFF(ctx, "club", TFFInput{Season: "20", League: "1166", Group: "1289", Team: "YOK SPOR"}); !errors.As(err, &fields) || fields["team"] == "" {
		t.Fatalf("unknown team must be refused: %v", err)
	}
	if _, err := svc.SetTFF(ctx, "club", TFFInput{Season: "20", League: "1166", Group: "1289", Team: " barışspor "}); err != nil {
		t.Fatal(err)
	}
	if repo.saved == nil || repo.saved.Team != "BARIŞSPOR" || repo.saved.Label != "2026-2027 Sezonu · U14 Ligi · 1. GRUP" {
		t.Fatalf("link keeps the page's name and label: %+v", repo.saved)
	}
	down := New(repo, nil, tffSource{err: footballdomain.ErrUpstream})
	if _, err := down.SetTFF(ctx, "club", TFFInput{Season: "20", League: "1166", Group: "1289", Team: "BARIŞSPOR"}); !errors.Is(err, domain.ErrTFFUnavailable) {
		t.Fatalf("an unreachable page is reported as such: %v", err)
	}
	if _, err := svc.ClearTFF(ctx, "club"); err != nil || repo.saved != nil {
		t.Fatalf("clear unlinks: %+v %v", repo.saved, err)
	}
}

func TestTFFDetailKeepsEveryClubMatchAndEveryWeek(t *testing.T) {
	detail, ok := tffDetail(ankaraTable, domain.TFFLink{Season: "20", League: "1166", Group: "1289", Team: "BARIŞSPOR"})
	if !ok {
		t.Fatal("linked team must be found")
	}
	rounds := []int{}
	for _, m := range detail.Matches {
		rounds = append(rounds, m.Round)
	}
	if len(rounds) != 4 || rounds[0] != 4 || rounds[1] != 5 || rounds[2] != 7 || rounds[3] != 8 {
		t.Fatalf("club matches oldest week first without the bye: %v", rounds)
	}
	if detail.Matches[0].Result != "win" || detail.Matches[2].Result != "" {
		t.Fatalf("played and unplayed: %+v", detail.Matches)
	}
	weeks := []int{}
	for _, w := range detail.Weeks {
		weeks = append(weeks, w.Number)
	}
	if len(weeks) != 4 || weeks[0] != 4 || weeks[1] != 5 || weeks[2] != 7 || weeks[3] != 8 {
		t.Fatalf("weeks without the bye-only week: %v", weeks)
	}
	five := detail.Weeks[1]
	if len(five.Matches) != 2 || !five.Matches[0].Own || five.Matches[1].Own || five.Matches[1].HomeName != "ÇUBUK SPOR 1959" || *five.Matches[1].HomeGoals != 3 {
		t.Fatalf("week 5 has the club's match and the other match: %+v", five.Matches)
	}
	if detail.CurrentWeek != 7 {
		t.Fatalf("without a page week the first week still to play is current: %d", detail.CurrentWeek)
	}
	if len(detail.Upcoming) != 2 || len(detail.Recent) != 2 {
		t.Fatalf("summary keeps the split: %+v %+v", detail.Upcoming, detail.Recent)
	}
}
