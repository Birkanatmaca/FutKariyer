package application

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"futcareer/backend/internal/discovery/domain"
)

func sampleVisits(now time.Time) []domain.Visit {
	return []domain.Visit{
		{VisitorID: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1", FullName: "Kulup Bir", Role: "club", Verified: true, FootballType: "amateur", District: "Cankaya", Days: 2, WeekDays: 1, ThisWeek: true, LastVisitedAt: now.Add(-48 * time.Hour), CanOpen: true},
		{VisitorID: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2", FullName: "Gizli Pro", Role: "coach", Verified: true, IsPro: true, Private: true, Days: 1, WeekDays: 1, ThisWeek: true, LastVisitedAt: now},
		{VisitorID: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa3", FullName: "Son Sporcu", Role: "player", FootballType: "halisaha", Club: "Beyan Spor", Days: 1, WeekDays: 1, ThisWeek: true, LastVisitedAt: now.Add(-time.Hour), CanOpen: true},
		{VisitorID: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa4", FullName: "Eski Sporcu", Role: "player", FootballType: "amateur", Days: 3, LastVisitedAt: now.Add(-20 * 24 * time.Hour)},
	}
}

func TestFreeOwnerSeesCountsAndOneRevealedRowOnly(t *testing.T) {
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	visits := sampleVisits(now)
	out := BuildVisitors(domain.VisitorOwner{ID: "owner", Role: "player", FootballType: "amateur"}, visits)
	if out.IsPro || out.WindowDays != 30 || out.Summary.Window.Visitors != 4 || out.Summary.Window.Visits != 7 {
		t.Fatalf("summary: %+v", out.Summary)
	}
	roles := out.Summary.Window.ByRole
	if roles.Club != 1 || roles.Player != 2 || roles.Coach != 0 || roles.Hidden != 1 {
		t.Fatalf("private visitor role must stay hidden from a free owner: %+v", roles)
	}
	if out.Summary.Week.Visitors != 3 || out.Summary.Week.Visits != 3 || out.Summary.Week.ByRole.Club != 1 {
		t.Fatalf("week: %+v", out.Summary.Week)
	}
	full := 0
	for _, row := range out.Items {
		switch row.Kind {
		case VisitorRowFull:
			full++
			// The most recent visitor is private; the revealed one is the next most recent public visitor.
			if row.Visitor == nil || row.Visitor.FullName != "Son Sporcu" || row.Key != row.Visitor.ID {
				t.Fatalf("revealed row: %+v", row)
			}
		case VisitorRowPrivate:
			if row.Role != "" || row.District != "" || row.Visitor != nil || row.VisitCount != 0 {
				t.Fatalf("private row leaks data: %+v", row)
			}
		case VisitorRowObscured:
			if row.Visitor != nil || row.VisitCount != 0 || row.Role == "" || !strings.HasPrefix(row.Key, "row-") {
				t.Fatalf("obscured row: %+v", row)
			}
		default:
			t.Fatalf("unknown row kind %q", row.Kind)
		}
	}
	if full != 1 || len(out.Items) != 4 {
		t.Fatalf("free owner must see exactly one revealed row of 4: %d", full)
	}
	raw, _ := json.Marshal(out)
	body := string(raw)
	for _, v := range visits {
		if v.FullName == "Son Sporcu" {
			continue
		}
		if strings.Contains(body, v.VisitorID) || strings.Contains(body, v.FullName) {
			t.Fatalf("hidden identity %s leaked: %s", v.FullName, body)
		}
	}
	if !strings.Contains(body, "Beyan Spor") {
		t.Fatal("revealed row should include the club statement")
	}
	// Hidden ranking: the private verified coach is not lifted above the verified club.
	if out.Items[0].Kind != VisitorRowObscured || out.Items[0].Role != "club" || out.Items[0].District != "Cankaya" {
		t.Fatalf("ranking for free owner: %+v", out.Items[0])
	}
}

func TestProOwnerSeesEveryIdentityIncludingPrivateBrowsers(t *testing.T) {
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	out := BuildVisitors(domain.VisitorOwner{ID: "owner", Role: "player", FootballType: "amateur", IsPro: true}, sampleVisits(now))
	if !out.IsPro || out.Summary.Window.ByRole.Hidden != 0 || out.Summary.Window.ByRole.Coach != 1 {
		t.Fatalf("pro summary: %+v", out.Summary)
	}
	order := []string{"Kulup Bir", "Gizli Pro", "Eski Sporcu", "Son Sporcu"}
	for i, row := range out.Items {
		if row.Kind != VisitorRowFull || row.Visitor == nil || row.Visitor.FullName != order[i] {
			t.Fatalf("row %d: %+v", i, row)
		}
	}
	if !out.Items[1].Visitor.Private || !out.Items[1].Visitor.IsPro || out.Items[0].Visitor.Private || out.Items[2].VisitCount != 3 {
		t.Fatalf("pro rows: %+v %+v", out.Items[0].Visitor, out.Items[2])
	}
}

func TestFreeOwnerWithOnlyPrivateVisitorsRevealsNobody(t *testing.T) {
	now := time.Now().UTC()
	out := BuildVisitors(domain.VisitorOwner{ID: "owner", Role: "club"}, []domain.Visit{{VisitorID: "x", FullName: "Gizli", Role: "player", IsPro: true, Private: true, Days: 1, LastVisitedAt: now}})
	if len(out.Items) != 1 || out.Items[0].Kind != VisitorRowPrivate {
		t.Fatalf("items: %+v", out.Items)
	}
}
