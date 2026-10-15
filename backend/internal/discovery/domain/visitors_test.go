package domain

import (
	"testing"
	"time"
)

func TestRankVisitorsOrder(t *testing.T) {
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	visits := []Visit{
		{VisitorID: "recent-player", Role: "player", FootballType: "halisaha", Days: 1, LastVisitedAt: now},
		{VisitorID: "repeat-player", Role: "player", FootballType: "halisaha", Days: 4, LastVisitedAt: now.Add(-48 * time.Hour)},
		{VisitorID: "same-type", Role: "player", FootballType: "amateur", Days: 1, LastVisitedAt: now.Add(-72 * time.Hour)},
		{VisitorID: "unverified-club", Role: "club", Verified: false, FootballType: "professional", Days: 9, LastVisitedAt: now},
		{VisitorID: "verified-coach", Role: "coach", Verified: true, FootballType: "unknown", Days: 1, LastVisitedAt: now.Add(-240 * time.Hour)},
		{VisitorID: "verified-club", Role: "club", Verified: true, FootballType: "amateur", Days: 1, LastVisitedAt: now.Add(-240 * time.Hour)},
		{VisitorID: "verified-player", Role: "player", Verified: true, FootballType: "professional", Days: 1, LastVisitedAt: now.Add(-time.Hour)},
	}
	RankVisitors("amateur", visits, nil)
	want := []string{"verified-club", "verified-coach", "same-type", "unverified-club", "repeat-player", "recent-player", "verified-player"}
	for i, id := range want {
		if visits[i].VisitorID != id {
			t.Fatalf("position %d: got %s want %s (%v)", i, visits[i].VisitorID, id, ids(visits))
		}
	}
}

func TestRankVisitorsUnknownOwnerTypeAndTies(t *testing.T) {
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	visits := []Visit{
		{VisitorID: "b", Role: "player", FootballType: "unknown", Days: 2, LastVisitedAt: now},
		{VisitorID: "a", Role: "player", FootballType: "unknown", Days: 2, LastVisitedAt: now},
		{VisitorID: "c", Role: "player", FootballType: "unknown", Days: 2, LastVisitedAt: now.Add(time.Minute)},
	}
	RankVisitors("unknown", visits, nil)
	if got := ids(visits); got[0] != "c" || got[1] != "a" || got[2] != "b" {
		t.Fatalf("unknown type must not match and ties sort by id: %v", got)
	}
}

func TestRankVisitorsHiddenRowsDoNotRankByIdentity(t *testing.T) {
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	visits := []Visit{
		{VisitorID: "plain", Role: "player", Days: 1, LastVisitedAt: now},
		{VisitorID: "private-club", Role: "club", Verified: true, FootballType: "amateur", Private: true, Days: 1, LastVisitedAt: now.Add(-time.Hour)},
	}
	RankVisitors("amateur", visits, func(v Visit) bool { return v.Private })
	if visits[0].VisitorID != "plain" {
		t.Fatalf("a hidden verified club must not be lifted to the top: %v", ids(visits))
	}
	RankVisitors("amateur", visits, nil)
	if visits[0].VisitorID != "private-club" {
		t.Fatalf("a Pro owner ranks private visitors by identity: %v", ids(visits))
	}
}

func ids(visits []Visit) []string {
	out := make([]string, len(visits))
	for i, v := range visits {
		out[i] = v.VisitorID
	}
	return out
}
