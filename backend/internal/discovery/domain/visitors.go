package domain

import (
	"sort"
	"time"
)

// VisitorWindowDays is how far back the "who viewed your profile" list looks.
const VisitorWindowDays = 30

// VisitorListLimit bounds the rows returned to the client after ranking.
const VisitorListLimit = 100

// Visit aggregates one visitor's views of a profile inside the window.
// Days is the number of distinct UTC days with a view (views are counted once per day);
// WeekDays counts those inside the last 7 days.
type Visit struct {
	VisitorID     string
	FullName      string
	Role          string
	Verified      bool
	IsPro         bool
	FootballType  string
	Club          string
	District      string
	CanOpen       bool
	Private       bool
	Days          int
	WeekDays      int
	ThisWeek      bool
	LastVisitedAt time.Time
}

// RankVisitors orders visitors for the profile owner:
//  1. verified clubs and coaches first,
//  2. then visitors with the owner's football type (unknown never matches),
//  3. then repeat visitors (more distinct days),
//  4. then the most recent visit; the visitor id keeps the order stable.
//
// hidden marks rows whose identity the owner may not see (private browsing seen
// by a non-Pro owner); only their visit days and time take part in ranking so the
// position does not reveal the hidden role, verification or football type.
func RankVisitors(ownerFootballType string, visits []Visit, hidden func(Visit) bool) {
	type key struct {
		provider, sameType bool
	}
	keyOf := func(v Visit) key {
		if hidden != nil && hidden(v) {
			return key{}
		}
		return key{
			provider: v.Verified && (v.Role == "club" || v.Role == "coach"),
			sameType: ownerFootballType != "" && ownerFootballType != "unknown" && v.FootballType == ownerFootballType,
		}
	}
	sort.SliceStable(visits, func(i, j int) bool {
		a, b := visits[i], visits[j]
		ka, kb := keyOf(a), keyOf(b)
		if ka.provider != kb.provider {
			return ka.provider
		}
		if ka.sameType != kb.sameType {
			return ka.sameType
		}
		if a.Days != b.Days {
			return a.Days > b.Days
		}
		if !a.LastVisitedAt.Equal(b.LastVisitedAt) {
			return a.LastVisitedAt.After(b.LastVisitedAt)
		}
		return a.VisitorID < b.VisitorID
	})
}

// VisitorOwner is the profile owner reading the list, with Pro evaluated on the server now.
type VisitorOwner struct {
	ID           string
	Role         string
	FootballType string
	IsPro        bool
}
