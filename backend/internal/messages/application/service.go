package application

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/messages/domain"
)

var validID = regexp.MustCompile(`^[a-f0-9]{32}$`)

type Service struct{ repo domain.Repository }

func New(repo domain.Repository) *Service { return &Service{repo: repo} }

func newID() (string, error) {
	var v [16]byte
	if _, err := rand.Read(v[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(v[:]), nil
}

func (s *Service) Inbox(ctx context.Context, userID string) (domain.Inbox, error) {
	return s.repo.Inbox(ctx, userID)
}

func (s *Service) Thread(ctx context.Context, userID, partnerID, rawCursor string) (domain.Thread, error) {
	if !validID.MatchString(partnerID) || partnerID == userID {
		return domain.Thread{}, domain.ErrNotFound
	}
	before, err := parseCursor(rawCursor)
	if err != nil {
		return domain.Thread{}, err
	}
	thread, err := s.repo.Thread(ctx, userID, partnerID, before)
	if err != nil {
		return thread, err
	}
	if len(thread.Items) > domain.PageSize {
		thread.Items = thread.Items[:domain.PageSize]
		last := thread.Items[len(thread.Items)-1]
		thread.NextCursor = base64.RawURLEncoding.EncodeToString([]byte(last.CreatedAt.UTC().Format(time.RFC3339Nano) + "|" + last.ID))
	}
	return thread, nil
}

func (s *Service) Send(ctx context.Context, userID, partnerID, body string) (domain.Message, error) {
	if !validID.MatchString(partnerID) || partnerID == userID {
		return domain.Message{}, domain.ErrNotFound
	}
	body = strings.TrimSpace(strings.ReplaceAll(body, "\r\n", "\n"))
	if n := utf8.RuneCountInString(body); n < 1 || n > domain.MaxBody {
		return domain.Message{}, auth.ValidationError{"body": "Mesaj 1-1000 karakter olmalı."}
	}
	messageID, err := newID()
	if err != nil {
		return domain.Message{}, err
	}
	conversationID, err := newID()
	if err != nil {
		return domain.Message{}, err
	}
	return s.repo.Send(ctx, userID, partnerID, messageID, conversationID, body)
}

func (s *Service) MarkRead(ctx context.Context, userID, partnerID string) error {
	if !validID.MatchString(partnerID) {
		return domain.ErrNotFound
	}
	return s.repo.MarkRead(ctx, userID, partnerID)
}

func parseCursor(raw string) (domain.Cursor, error) {
	if raw == "" {
		return domain.Cursor{}, nil
	}
	invalid := auth.ValidationError{"cursor": "Mesaj sayfası geçersiz. Yenile."}
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil || len(raw) > 256 {
		return domain.Cursor{}, invalid
	}
	parts := strings.Split(string(decoded), "|")
	if len(parts) != 2 || !validID.MatchString(parts[1]) {
		return domain.Cursor{}, invalid
	}
	at, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return domain.Cursor{}, invalid
	}
	return domain.Cursor{ID: parts[1], CreatedAt: at}, nil
}
