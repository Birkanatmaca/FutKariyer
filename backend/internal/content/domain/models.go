package domain

import (
	"context"
	"time"
)

type Image struct {
	ID, MIME string
	Data     []byte
}
type Advertisement struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	ImageID   string `json:"imageId"`
	Active    bool   `json:"active"`
	SortOrder int    `json:"sortOrder"`
	Schedule
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Schedule is when an item is live and how long it stays on screen in the
// app's carousel. A nil start or end leaves that side open.
type Schedule struct {
	DisplaySeconds int        `json:"displaySeconds"`
	StartsAt       *time.Time `json:"startsAt"`
	EndsAt         *time.Time `json:"endsAt"`
}

const (
	MinDisplaySeconds = 3
	MaxDisplaySeconds = 30
)

type Article struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Summary    string `json:"summary"`
	Body       string `json:"body"`
	ImageID    string `json:"imageId"`
	Published  bool   `json:"published"`
	ShowOnHome bool   `json:"showOnHome"`
	// SortOrder is the priority in lists and the home carousel, lower first.
	SortOrder int `json:"sortOrder"`
	Schedule
	// ReviewStatus is pending|approved|rejected; admin articles are always approved.
	ReviewStatus string    `json:"reviewStatus"`
	AuthorName   string    `json:"authorName"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}
type Page[T any] struct {
	Items      []T `json:"items"`
	Page       int `json:"page"`
	PageSize   int `json:"pageSize"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}
type Home struct {
	Advertisements []Advertisement `json:"advertisements"`
	News           []Article       `json:"news"`
}
type Repository interface {
	SaveImage(context.Context, Image) error
	Image(context.Context, string, bool) (Image, error)
	Ads(context.Context, bool, int) (Page[Advertisement], error)
	SaveAd(context.Context, Advertisement, bool) (Advertisement, error)
	DeleteAd(context.Context, string) error
	News(context.Context, bool, bool, int) (Page[Article], error)
	Article(context.Context, string, bool) (Article, error)
	SaveArticle(context.Context, Article, bool) (Article, error)
	DeleteArticle(context.Context, string) error
	SubmitClubArticle(context.Context, string, Article) (Article, error)
	ClubArticles(context.Context, string) ([]Article, error)
	ReviewClubArticle(context.Context, string, bool) (Article, error)
	PendingClubArticles(context.Context) ([]Article, error)
	PopupRepository
}
