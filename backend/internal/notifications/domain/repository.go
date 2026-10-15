package domain

import (
	"context"
	"errors"
	"time"
)

var ErrNotFound = errors.New("notification not found")
var ErrNoRecipient = errors.New("notification recipient not found")

const (
	KindTeamApplication = "team_application"
	KindPayment         = "payment"
	KindOpportunity     = "opportunity"
	KindGift            = "gift"
	KindGameReward      = "game_reward"
	KindNewsReview      = "news_review"
	KindConnection      = "connection"
	KindTournament      = "tournament"
)

// ValidKind lists every kind the notification center knows how to display.
func ValidKind(kind string) bool {
	switch kind {
	case KindTeamApplication, KindPayment, KindOpportunity, KindGift, KindGameReward, KindNewsReview, KindConnection, KindTournament:
		return true
	}
	return false
}

type Notification struct {
	ID         string     `json:"id"`
	Kind       string     `json:"kind"`
	Title      string     `json:"title"`
	Body       string     `json:"body"`
	ResourceID string     `json:"resourceId"`
	CreatedAt  time.Time  `json:"createdAt"`
	ReadAt     *time.Time `json:"readAt"`
}

type NewNotification struct {
	RecipientID string
	Kind        string
	Title       string
	Body        string
	ResourceID  string
	SourceKey   string
}

type Page struct {
	Items       []Notification `json:"items"`
	Page        int            `json:"page"`
	PageSize    int            `json:"pageSize"`
	Total       int            `json:"total"`
	TotalPages  int            `json:"totalPages"`
	UnreadCount int            `json:"unreadCount"`
}

type Repository interface {
	List(context.Context, string, int, int) (Page, error)
	UnreadCount(context.Context, string) (int, error)
	MarkRead(context.Context, string, string) error
	MarkAllRead(context.Context, string) error
}

type Announcement struct {
	ID          string    `json:"id"`
	Kind        string    `json:"kind"`
	Title       string    `json:"title"`
	Body        string    `json:"body"`
	Audience    string    `json:"audience"`
	TargetEmail string    `json:"targetEmail"`
	CreatedAt   time.Time `json:"createdAt"`
	Recipients  int       `json:"recipients"`
}

type AnnouncementRepository interface {
	CreateAnnouncement(context.Context, Announcement, string) (Announcement, error)
	ListAnnouncements(context.Context) ([]Announcement, error)
}
