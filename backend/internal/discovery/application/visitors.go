package application

import (
	"context"
	"strconv"
	"time"

	"futcareer/backend/internal/discovery/domain"
)

// Row kinds of the visitors list.
const (
	// VisitorRowFull carries the visitor identity (Pro owner, or the single revealed row for free owners).
	VisitorRowFull = "visitor"
	// VisitorRowObscured is a free owner's hidden row: role, time and public club district only.
	VisitorRowObscured = "obscured"
	// VisitorRowPrivate is a Pro member browsing privately, seen by a non-Pro owner.
	VisitorRowPrivate = "private"
)

type VisitorIdentity struct {
	ID           string `json:"id"`
	FullName     string `json:"fullName"`
	Role         string `json:"role"`
	Verified     bool   `json:"verified"`
	IsPro        bool   `json:"isPro"`
	Club         string `json:"club"`
	District     string `json:"district"`
	FootballType string `json:"footballType"`
	CanOpen      bool   `json:"canOpen"`
	// Private tells a Pro owner that this visitor browsed privately.
	Private bool `json:"private"`
}

// VisitorRow never carries ids or names unless Kind is VisitorRowFull.
type VisitorRow struct {
	Key           string           `json:"key"`
	Kind          string           `json:"kind"`
	LastVisitedAt time.Time        `json:"lastVisitedAt"`
	Role          string           `json:"role,omitempty"`
	District      string           `json:"district,omitempty"`
	VisitCount    int              `json:"visitCount,omitempty"`
	Visitor       *VisitorIdentity `json:"visitor,omitempty"`
}

type RoleCounts struct {
	Player    int `json:"player"`
	Club      int `json:"club"`
	Coach     int `json:"coach"`
	Organizer int `json:"organizer"`
	// Hidden counts private Pro visitors whose role a non-Pro owner may not see.
	Hidden int `json:"hidden"`
}

type VisitorTotals struct {
	Visitors int        `json:"visitors"`
	Visits   int        `json:"visits"`
	ByRole   RoleCounts `json:"byRole"`
}

type VisitorSummary struct {
	Window VisitorTotals `json:"window"`
	Week   VisitorTotals `json:"week"`
}

type Visitors struct {
	IsPro      bool           `json:"isPro"`
	WindowDays int            `json:"windowDays"`
	Summary    VisitorSummary `json:"summary"`
	Items      []VisitorRow   `json:"items"`
}

func (c *RoleCounts) add(role string) {
	switch role {
	case "player":
		c.Player++
	case "club":
		c.Club++
	case "coach":
		c.Coach++
	case "organizer":
		c.Organizer++
	default:
		c.Hidden++
	}
}

func identity(v domain.Visit, ownerIsPro bool) *VisitorIdentity {
	return &VisitorIdentity{ID: v.VisitorID, FullName: v.FullName, Role: v.Role, Verified: v.Verified, IsPro: v.IsPro, Club: v.Club, District: v.District, FootballType: v.FootballType, CanOpen: v.CanOpen, Private: ownerIsPro && v.Private}
}

// BuildVisitors projects ranked visits for one owner. Pro owners see everyone, private
// browsers included. Free owners see counts, one revealed row (the most recent visitor
// who did not browse privately) and anonymous rows that contain no identity.
func BuildVisitors(owner domain.VisitorOwner, visits []domain.Visit) Visitors {
	hidden := func(v domain.Visit) bool { return !owner.IsPro && v.Private }
	out := Visitors{IsPro: owner.IsPro, WindowDays: domain.VisitorWindowDays, Items: []VisitorRow{}}
	revealed := ""
	var revealedAt time.Time
	for _, v := range visits {
		role := v.Role
		if hidden(v) {
			role = ""
		}
		out.Summary.Window.Visitors++
		out.Summary.Window.Visits += v.Days
		out.Summary.Window.ByRole.add(role)
		if v.ThisWeek {
			out.Summary.Week.Visitors++
			out.Summary.Week.Visits += v.WeekDays
			out.Summary.Week.ByRole.add(role)
		}
		if !owner.IsPro && !v.Private && (revealed == "" || v.LastVisitedAt.After(revealedAt) || (v.LastVisitedAt.Equal(revealedAt) && v.VisitorID < revealed)) {
			revealed, revealedAt = v.VisitorID, v.LastVisitedAt
		}
	}
	ranked := append([]domain.Visit(nil), visits...)
	domain.RankVisitors(owner.FootballType, ranked, hidden)
	if len(ranked) > domain.VisitorListLimit {
		ranked = ranked[:domain.VisitorListLimit]
	}
	for index, v := range ranked {
		switch {
		case owner.IsPro || v.VisitorID == revealed:
			out.Items = append(out.Items, VisitorRow{Key: v.VisitorID, Kind: VisitorRowFull, LastVisitedAt: v.LastVisitedAt, VisitCount: v.Days, Visitor: identity(v, owner.IsPro)})
		case v.Private:
			out.Items = append(out.Items, VisitorRow{Key: "row-" + strconv.Itoa(index), Kind: VisitorRowPrivate, LastVisitedAt: v.LastVisitedAt})
		default:
			out.Items = append(out.Items, VisitorRow{Key: "row-" + strconv.Itoa(index), Kind: VisitorRowObscured, LastVisitedAt: v.LastVisitedAt, Role: v.Role, District: v.District})
		}
	}
	return out
}

func (s *Service) Visitors(ctx context.Context, viewer domain.Viewer) (Visitors, error) {
	owner, visits, err := s.repo.Visitors(ctx, viewer.ID)
	if err != nil {
		return Visitors{}, err
	}
	return BuildVisitors(owner, visits), nil
}
