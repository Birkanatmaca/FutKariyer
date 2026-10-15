package domain

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	ErrNotFound     = errors.New("moderation target not found")
	ErrForbidden    = errors.New("moderation action not allowed")
	ErrInvalid      = errors.New("invalid moderation input")
	ErrDuplicate    = errors.New("target already reported")
	ErrRateLimited  = errors.New("too many reports")
	ErrAlreadyFinal = errors.New("report already resolved")
)

// DailyReportLimit stops one account from flooding the review queue.
const DailyReportLimit = 20

var idPattern = regexp.MustCompile(`^[a-f0-9]{32}$`)

func ValidID(id string) bool { return idPattern.MatchString(id) }

var (
	TargetKinds = []string{"post", "reply", "user"}
	Reasons     = []string{"spam", "harassment", "inappropriate", "impersonation", "other"}
	Actions     = []string{"dismiss", "remove", "suspend"}
)

func oneOf(value string, values []string) bool {
	for _, item := range values {
		if item == value {
			return true
		}
	}
	return false
}

type ReportInput struct {
	TargetKind string `json:"targetKind"`
	TargetID   string `json:"targetId"`
	Reason     string `json:"reason"`
	Note       string `json:"note"`
}

// Normalize trims the note and checks the report fields.
func (in ReportInput) Normalize() (ReportInput, error) {
	in.Note = strings.TrimSpace(in.Note)
	if !oneOf(in.TargetKind, TargetKinds) || !ValidID(in.TargetID) || !oneOf(in.Reason, Reasons) || utf8.RuneCountInString(in.Note) > 500 {
		return in, ErrInvalid
	}
	return in, nil
}

// Target is the reported content as resolved by the server.
type Target struct {
	UserID  string
	Excerpt string
}

type Report struct {
	ID           string     `json:"id"`
	TargetKind   string     `json:"targetKind"`
	TargetID     string     `json:"targetId"`
	TargetUserID string     `json:"targetUserId,omitempty"`
	TargetName   string     `json:"targetName"`
	TargetRole   string     `json:"targetRole"`
	Excerpt      string     `json:"excerpt"`
	Reason       string     `json:"reason"`
	Note         string     `json:"note"`
	ReporterName string     `json:"reporterName"`
	Status       string     `json:"status"`
	CreatedAt    time.Time  `json:"createdAt"`
	ResolvedAt   *time.Time `json:"resolvedAt,omitempty"`
	// Open reports about the same target; helps the admin prioritise.
	TargetReports int `json:"targetReports"`
}

type ReportPage struct {
	Items      []Report `json:"items"`
	Page       int      `json:"page"`
	PageSize   int      `json:"pageSize"`
	Total      int      `json:"total"`
	TotalPages int      `json:"totalPages"`
}

type BlockedUser struct {
	ID        string    `json:"id"`
	FullName  string    `json:"fullName"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

func ValidAction(action string) bool { return oneOf(action, Actions) }

type Repository interface {
	// Target resolves an active, visible target for the reporter.
	Target(ctx context.Context, reporterID, kind, id string) (Target, error)
	CreateReport(ctx context.Context, id, reporterID string, in ReportInput, target Target) error
	Reports(ctx context.Context, status string, page, pageSize int) (ReportPage, error)
	// Resolve applies the action to the report and closes every open report
	// about the same target.
	Resolve(ctx context.Context, id, action string) (Report, error)
	Block(ctx context.Context, blockerID, blockedID string) error
	Unblock(ctx context.Context, blockerID, blockedID string) error
	Blocks(ctx context.Context, blockerID string) ([]BlockedUser, error)
}
