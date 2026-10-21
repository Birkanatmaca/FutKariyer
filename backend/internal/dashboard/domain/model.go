// Package domain: the admin panel's Ana sayfa (21 Oct 2026), one read-only
// summary of every section for a time window, with daily series for charts.
package domain

import (
	"context"
	"time"
)

// Windows the page offers, in days.
var Windows = []int{7, 30, 90}

type Query struct {
	Days  int
	Since time.Time
	// Prev is the start of the equal window before Since (for change rates).
	Prev time.Time
	Now  time.Time
}

type Day struct {
	Date         string `json:"date"`
	Players      int    `json:"players"`
	Coaches      int    `json:"coaches"`
	Clubs        int    `json:"clubs"`
	Posts        int    `json:"posts"`
	Replies      int    `json:"replies"`
	Likes        int    `json:"likes"`
	GamePlays    int    `json:"gamePlays"`
	RevenueMinor int64  `json:"revenueMinor"`
	Orders       int    `json:"orders"`
	Errors       int    `json:"errors"`
	Warnings     int    `json:"warnings"`
}

type Slice struct {
	Key   string `json:"key"`
	Value int    `json:"value"`
}

type KPIs struct {
	Users        int   `json:"users"`
	NewUsers     int   `json:"newUsers"`
	NewUsersPrev int   `json:"newUsersPrev"`
	Active24h    int   `json:"active24h"`
	Active7d     int   `json:"active7d"`
	ProMembers   int   `json:"proMembers"`
	Revenue      int64 `json:"revenueMinor"`
	RevenuePrev  int64 `json:"revenuePrevMinor"`
	PaidOrders   int   `json:"paidOrders"`
	Posts        int   `json:"posts"`
	PostsPrev    int   `json:"postsPrev"`
	GamePlays    int   `json:"gamePlays"`
}

// Modules is one small block per panel section.
type Modules struct {
	Users struct {
		Total      int `json:"total"`
		Players    int `json:"players"`
		Coaches    int `json:"coaches"`
		Clubs      int `json:"clubs"`
		Organizers int `json:"organizers"`
		Verified   int `json:"verified"`
		Suspended  int `json:"suspended"`
	} `json:"users"`
	Clubs struct {
		Total     int `json:"total"`
		Verified  int `json:"verified"`
		TFFLinked int `json:"tffLinked"`
		WithStaff int `json:"withStaff"`
		Squad     int `json:"squadPlayers"`
	} `json:"clubs"`
	Applications struct {
		Pending  int `json:"pending"`
		Approved int `json:"approved"`
		Rejected int `json:"rejected"`
	} `json:"applications"`
	TeamRequests struct {
		Pending  int `json:"pending"`
		Accepted int `json:"accepted"`
	} `json:"teamRequests"`
	Reports struct {
		Open     int `json:"open"`
		Resolved int `json:"resolved"`
	} `json:"reports"`
	News struct {
		Published     int `json:"published"`
		PendingReview int `json:"pendingReview"`
		New           int `json:"new"`
	} `json:"news"`
	Ads struct {
		Active int `json:"active"`
		Total  int `json:"total"`
	} `json:"ads"`
	Popups struct {
		Active int `json:"active"`
		Views  int `json:"views"`
	} `json:"popups"`
	Announcements struct {
		Sent  int `json:"sent"`
		Total int `json:"total"`
	} `json:"announcements"`
	Leagues struct {
		Active   int `json:"active"`
		Teams    int `json:"teams"`
		Upcoming int `json:"upcomingMatches"`
		Played   int `json:"playedMatches"`
	} `json:"leagues"`
	Rating struct {
		Season       string     `json:"season"`
		EndsAt       *time.Time `json:"endsAt"`
		Participants int        `json:"participants"`
		Points       int        `json:"points"`
	} `json:"rating"`
	Payments struct {
		Revenue  int64 `json:"revenueMinor"`
		Paid     int   `json:"paid"`
		Refunded int   `json:"refunded"`
		Pending  int   `json:"pending"`
		Pro      int   `json:"pro"`
	} `json:"payments"`
	Gifts struct {
		Sent    int `json:"sent"`
		Claimed int `json:"claimed"`
	} `json:"gifts"`
	Audit struct {
		Actions     int `json:"actions"`
		AdminLogins int `json:"adminLogins"`
	} `json:"audit"`
	Logs struct {
		Errors   int `json:"errors"`
		Warnings int `json:"warnings"`
		Security int `json:"security"`
	} `json:"logs"`
	Social struct {
		Posts   int `json:"posts"`
		Replies int `json:"replies"`
		Likes   int `json:"likes"`
		Follows int `json:"follows"`
	} `json:"social"`
	Connections struct {
		Pending  int `json:"pending"`
		Accepted int `json:"accepted"`
	} `json:"connections"`
	Tournaments struct {
		Open    int `json:"open"`
		Entries int `json:"entries"`
	} `json:"tournaments"`
}

type RecentUser struct {
	ID        string    `json:"id"`
	FullName  string    `json:"fullName"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

type RecentAction struct {
	At        time.Time `json:"at"`
	Action    string    `json:"action"`
	ActorName string    `json:"actorName"`
	ActorType string    `json:"actorType"`
}

type Dashboard struct {
	Days          int            `json:"days"`
	GeneratedAt   time.Time      `json:"generatedAt"`
	KPIs          KPIs           `json:"kpis"`
	Daily         []Day          `json:"daily"`
	Roles         []Slice        `json:"roles"`
	FootballTypes []Slice        `json:"footballTypes"`
	Positions     []Slice        `json:"positions"`
	Games         []Slice        `json:"games"`
	Modules       Modules        `json:"modules"`
	RecentUsers   []RecentUser   `json:"recentUsers"`
	RecentActions []RecentAction `json:"recentActions"`
}

type Repository interface {
	Dashboard(context.Context, Query) (Dashboard, error)
}
