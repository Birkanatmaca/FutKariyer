package application

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/social/domain"
)

var idPattern = regexp.MustCompile(`^[a-f0-9]{32}$`)

type Service struct{ repo domain.Repository }

func New(repo domain.Repository) *Service { return &Service{repo: repo} }

func cleanBody(body string) (string, error) {
	body = strings.TrimSpace(strings.ReplaceAll(body, "\r\n", "\n"))
	if !utf8.ValidString(body) || utf8.RuneCountInString(body) < 1 || utf8.RuneCountInString(body) > domain.MaxBodyLength {
		return "", auth.ValidationError{"body": "1–500 karakter arasında bir metin yaz."}
	}
	for _, r := range body {
		if unicode.IsControl(r) && r != '\n' && r != '\t' {
			return "", auth.ValidationError{"body": "Metinde geçersiz karakter var."}
		}
	}
	return body, nil
}
func newID() (string, error) {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}
func parseCursor(raw string) (domain.Cursor, error) {
	if raw == "" {
		return domain.Cursor{}, nil
	}
	invalid := auth.ValidationError{"cursor": "Akış sayfası geçersiz. Akışı yenile."}
	if len(raw) > 256 {
		return domain.Cursor{}, invalid
	}
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return domain.Cursor{}, invalid
	}
	parts := strings.Split(string(decoded), "|")
	if len(parts) != 2 || !idPattern.MatchString(parts[1]) {
		return domain.Cursor{}, invalid
	}
	createdAt, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil || createdAt.IsZero() {
		return domain.Cursor{}, invalid
	}
	return domain.Cursor{ID: parts[1], CreatedAt: createdAt.UTC()}, nil
}
func cursor(id string, createdAt time.Time) string {
	return base64.RawURLEncoding.EncodeToString([]byte(createdAt.UTC().Format(time.RFC3339Nano) + "|" + id))
}
func parseFeedCursor(raw, scope string) (domain.FeedCursor, error) {
	if raw == "" {
		return domain.FeedCursor{SnapshotAt: time.Now().UTC()}, nil
	}
	invalid := auth.ValidationError{"cursor": "Akış sayfası geçersiz. Akışı yenile."}
	if len(raw) > 256 {
		return domain.FeedCursor{}, invalid
	}
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return domain.FeedCursor{}, invalid
	}
	parts := strings.Split(string(decoded), "|")
	if len(parts) != 3 || parts[2] != scope {
		return domain.FeedCursor{}, invalid
	}
	snapshot, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil || snapshot.IsZero() {
		return domain.FeedCursor{}, invalid
	}
	offset, err := strconv.Atoi(parts[1])
	if err != nil || offset < domain.PageSize || offset > 1000000 || offset%domain.PageSize != 0 {
		return domain.FeedCursor{}, invalid
	}
	return domain.FeedCursor{SnapshotAt: snapshot.UTC(), Offset: offset}, nil
}
func feedCursor(snapshot time.Time, offset int, scope string) string {
	value := snapshot.UTC().Format(time.RFC3339Nano) + "|" + strconv.Itoa(offset) + "|" + scope
	return base64.RawURLEncoding.EncodeToString([]byte(value))
}
func (s *Service) Feed(ctx context.Context, userID, rawCursor, scope string) (domain.Page[domain.Post], error) {
	if scope != "" && scope != "explore" && scope != "following" {
		return domain.Page[domain.Post]{}, auth.ValidationError{"scope": "Geçerli bir akış seç."}
	}
	after, err := parseFeedCursor(rawCursor, scope)
	if err != nil {
		return domain.Page[domain.Post]{}, err
	}
	items, err := s.repo.Feed(ctx, userID, after, scope == "following")
	if err != nil {
		return domain.Page[domain.Post]{}, err
	}
	out := domain.Page[domain.Post]{Items: items}
	if len(items) > domain.PageSize {
		out.Items = items[:domain.PageSize]
		out.NextCursor = feedCursor(after.SnapshotAt, after.Offset+domain.PageSize, scope)
	}
	return out, nil
}
func (s *Service) GetPost(ctx context.Context, userID, id string) (domain.Post, error) {
	if !idPattern.MatchString(id) {
		return domain.Post{}, domain.ErrNotFound
	}
	return s.repo.GetPost(ctx, userID, id)
}
// CreatePost stores a post; showOnProfile only applies to a post with media.
func (s *Service) CreatePost(ctx context.Context, userID, body string, data []byte, showOnProfile bool) (domain.Post, error) {
	var media *domain.Attachment
	var err error
	if len(data) > 0 {
		media, err = validateMedia(data)
		if err != nil {
			return domain.Post{}, err
		}
		media.OnProfile = showOnProfile
	}
	if strings.TrimSpace(body) != "" || media == nil {
		body, err = cleanBody(body)
		if err != nil {
			return domain.Post{}, err
		}
	} else {
		body = ""
	}
	id, err := newID()
	if err != nil {
		return domain.Post{}, err
	}
	return s.repo.CreatePost(ctx, userID, id, body, media)
}
func (s *Service) Media(ctx context.Context, viewerID, id string) (domain.Attachment, error) {
	if !idPattern.MatchString(id) {
		return domain.Attachment{}, domain.ErrNotFound
	}
	return s.repo.Media(ctx, viewerID, id)
}
func (s *Service) SetFollow(ctx context.Context, userID, id string, following bool) error {
	if !idPattern.MatchString(id) {
		return domain.ErrNotFound
	}
	if userID == id {
		return auth.ValidationError{"following": "Kendini takip edemezsin."}
	}
	return s.repo.SetFollow(ctx, userID, id, following)
}
func (s *Service) DeletePost(ctx context.Context, userID, id string) error {
	if !idPattern.MatchString(id) {
		return domain.ErrNotFound
	}
	return s.repo.DeletePost(ctx, userID, id)
}
func (s *Service) SetLike(ctx context.Context, userID, id string, liked bool) (domain.Post, error) {
	if !idPattern.MatchString(id) {
		return domain.Post{}, domain.ErrNotFound
	}
	return s.repo.SetLike(ctx, userID, id, liked)
}
// UserPosts pages an author's posts for a profile; filter "media" keeps the
// photo and video posts the author chose to show on their profile.
func (s *Service) UserPosts(ctx context.Context, viewerID, authorID, rawCursor, filter string) (domain.Page[domain.Post], error) {
	if !idPattern.MatchString(authorID) {
		return domain.Page[domain.Post]{}, domain.ErrNotFound
	}
	if filter != "" && filter != "media" {
		return domain.Page[domain.Post]{}, auth.ValidationError{"filter": "Geçerli bir gönderi filtresi seç."}
	}
	after, err := parseCursor(rawCursor)
	if err != nil {
		return domain.Page[domain.Post]{}, err
	}
	items, err := s.repo.UserPosts(ctx, viewerID, authorID, after, filter == "media")
	if err != nil {
		return domain.Page[domain.Post]{}, err
	}
	out := domain.Page[domain.Post]{Items: items}
	if len(items) > domain.PageSize {
		out.Items = items[:domain.PageSize]
		last := out.Items[len(out.Items)-1]
		out.NextCursor = cursor(last.ID, last.CreatedAt)
	}
	return out, nil
}
func (s *Service) Replies(ctx context.Context, userID, postID, rawCursor string) (domain.Page[domain.Reply], error) {
	if !idPattern.MatchString(postID) {
		return domain.Page[domain.Reply]{}, domain.ErrNotFound
	}
	after, err := parseCursor(rawCursor)
	if err != nil {
		return domain.Page[domain.Reply]{}, err
	}
	items, err := s.repo.Replies(ctx, userID, postID, after)
	if err != nil {
		return domain.Page[domain.Reply]{}, err
	}
	out := domain.Page[domain.Reply]{Items: items}
	if len(items) > domain.PageSize {
		out.Items = items[:domain.PageSize]
		last := out.Items[len(out.Items)-1]
		out.NextCursor = cursor(last.ID, last.CreatedAt)
	}
	return out, nil
}
func (s *Service) CreateReply(ctx context.Context, userID, postID, body string) (domain.Reply, error) {
	if !idPattern.MatchString(postID) {
		return domain.Reply{}, domain.ErrNotFound
	}
	body, err := cleanBody(body)
	if err != nil {
		return domain.Reply{}, err
	}
	id, err := newID()
	if err != nil {
		return domain.Reply{}, err
	}
	return s.repo.CreateReply(ctx, userID, postID, id, body)
}
func (s *Service) DeleteReply(ctx context.Context, userID, postID, id string) error {
	if !idPattern.MatchString(postID) || !idPattern.MatchString(id) {
		return domain.ErrNotFound
	}
	return s.repo.DeleteReply(ctx, userID, postID, id)
}
