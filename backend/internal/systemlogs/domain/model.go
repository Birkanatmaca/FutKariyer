// Package domain: Sistem logları (20 Oct 2026), the log lines kept in the
// database so administrators can read and manage them in the panel.
package domain

import (
	"context"
	"errors"
	"time"
)

var ErrNotFound = errors.New("log line not found")

type Entry struct {
	ID          int64          `json:"id"`
	At          time.Time      `json:"at"`
	Level       string         `json:"level"`
	Event       string         `json:"event"`
	RequestID   string         `json:"requestId"`
	Method      string         `json:"method"`
	Route       string         `json:"route"`
	Status      int            `json:"status"`
	DurationMS  int            `json:"durationMs"`
	UserID      string         `json:"userId"`
	AccountType string         `json:"accountType"`
	IP          string         `json:"ip"`
	Client      string         `json:"client"`
	AppVersion  string         `json:"appVersion"`
	Version     string         `json:"version"`
	Security    bool           `json:"security"`
	Message     string         `json:"message"`
	Attrs       map[string]any `json:"attrs"`
}

// Kinds are the panel's quick filters.
const (
	KindAll      = ""
	KindErrors   = "errors"   // level ERROR
	KindWarnings = "warnings" // level WARN and above
	KindSecurity = "security" // security events
	KindClient   = "client"   // app error reports
	KindSlow     = "slow"     // slow requests and queries
	KindRequests = "requests" // access lines
)

var Kinds = []string{KindAll, KindErrors, KindWarnings, KindSecurity, KindClient, KindSlow, KindRequests}

type Query struct {
	Kind string
	// Search matches a request id or support code (its end), an event name
	// prefix or text in the message.
	Search string
	UserID string
	Since  time.Time
	Page   int
}

const PageSize = 50

type Page struct {
	Items []Entry `json:"items"`
	Total int     `json:"total"`
	Page  int     `json:"page"`
}

type EventCount struct {
	Event string    `json:"event"`
	Count int       `json:"count"`
	Last  time.Time `json:"last"`
}

type RouteCount struct {
	Route  string `json:"route"`
	Count  int    `json:"count"`
	MaxMS  int    `json:"maxMs"`
	Errors int    `json:"errors"`
}

type Bucket struct {
	At       time.Time `json:"at"`
	Errors   int       `json:"errors"`
	Warnings int       `json:"warnings"`
}

// Summary is the top of the page for a time window.
type Summary struct {
	Since        time.Time    `json:"since"`
	Errors       int          `json:"errors"`
	Warnings     int          `json:"warnings"`
	Security     int          `json:"security"`
	ClientErrors int          `json:"clientErrors"`
	Slow         int          `json:"slow"`
	TopEvents    []EventCount `json:"topEvents"`
	SlowRoutes   []RouteCount `json:"slowRoutes"`
	Timeline     []Bucket     `json:"timeline"`
	// Live counters of the running API (since it started).
	Live Live `json:"live"`
}

type Live struct {
	Version       string  `json:"version"`
	UptimeSeconds float64 `json:"uptimeSeconds"`
	Requests      float64 `json:"requests"`
	ServerErrors  float64 `json:"serverErrors"`
	Level         string  `json:"level"`
	Dropped       int64   `json:"dropped"`
}

// Settings decide what is written and kept.
type Settings struct {
	Level         string    `json:"level"`
	StoreRequests bool      `json:"storeRequests"`
	RequestDays   int       `json:"requestDays"`
	ProblemDays   int       `json:"problemDays"`
	SecurityDays  int       `json:"securityDays"`
	UpdatedAt     time.Time `json:"updatedAt"`
	UpdatedBy     string    `json:"updatedBy"`
}

type Repository interface {
	Insert(ctx context.Context, entries []Entry) error
	List(ctx context.Context, q Query) (Page, error)
	Get(ctx context.Context, id int64) (Entry, error)
	Summary(ctx context.Context, since time.Time) (Summary, error)
	Settings(ctx context.Context) (Settings, error)
	SaveSettings(ctx context.Context, s Settings, adminID string) (Settings, error)
	// Cleanup removes lines past their retention, in batches; it returns how
	// many went.
	Cleanup(ctx context.Context, s Settings, now time.Time) (int64, error)
}
