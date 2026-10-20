package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound    = errors.New("social content not found")
	ErrForbidden   = errors.New("social operation forbidden")
	ErrRateLimited = errors.New("social writing rate limited")
)

const MaxBodyLength = 500
const PageSize = 20

type Author struct {
	ID            string `json:"id"`
	FullName      string `json:"fullName"`
	Role          string `json:"role"`
	Verified      bool   `json:"verified"`
	IsPro         bool   `json:"isPro,omitempty"`
	Following     bool   `json:"following"`
	FootballType  string `json:"footballType,omitempty"`
	LicenseStatus string `json:"licenseStatus,omitempty"`
	AvatarVersion int    `json:"avatarVersion"`
}

type Media struct {
	Kind   string `json:"kind"`
	MIME   string `json:"mime"`
	Size   int    `json:"size"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}
type Attachment struct {
	Media
	Data []byte
	// OnProfile also lists the media in the author's profile gallery tabs.
	OnProfile bool
}

type Post struct {
	ID         string    `json:"id"`
	Author     Author    `json:"author"`
	Body       string    `json:"body"`
	Media      *Media    `json:"media"`
	CreatedAt  time.Time `json:"createdAt"`
	LikeCount  int       `json:"likeCount"`
	ReplyCount int       `json:"replyCount"`
	Liked      bool      `json:"liked"`
	Owned      bool      `json:"owned"`
	// Only media posts can be shown in the author's profile gallery.
	ShowOnProfile bool `json:"showOnProfile"`
}

type Reply struct {
	ID        string    `json:"id"`
	PostID    string    `json:"postId"`
	Author    Author    `json:"author"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"createdAt"`
	Owned     bool      `json:"owned"`
}

type Cursor struct {
	ID        string
	CreatedAt time.Time
}
type FeedCursor struct {
	SnapshotAt time.Time
	Offset     int
}
type Page[T any] struct {
	Items      []T    `json:"items"`
	NextCursor string `json:"nextCursor"`
}

type Repository interface {
	Feed(context.Context, string, FeedCursor, bool) ([]Post, error)
	GetPost(context.Context, string, string) (Post, error)
	// UserPosts pages an author's posts newest first; profileMedia keeps
	// only the media posts shown on their profile.
	UserPosts(ctx context.Context, viewerID, authorID string, after Cursor, profileMedia bool) ([]Post, error)
	CreatePost(context.Context, string, string, string, *Attachment) (Post, error)
	DeletePost(context.Context, string, string) error
	Media(ctx context.Context, viewerID, id string) (Attachment, error)
	SetFollow(context.Context, string, string, bool) error
	SetLike(context.Context, string, string, bool) (Post, error)
	Replies(context.Context, string, string, Cursor) ([]Reply, error)
	CreateReply(context.Context, string, string, string, string) (Reply, error)
	DeleteReply(context.Context, string, string, string) error
}
