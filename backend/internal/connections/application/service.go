package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"regexp"
	"strings"
	"unicode/utf8"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/connections/domain"
)

var validID = regexp.MustCompile(`^[a-f0-9]{32}$`)

type Service struct{ repo domain.Repository }

func New(repo domain.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Send(ctx context.Context, senderID, recipientID, message string) (domain.Connection, error) {
	message = strings.TrimSpace(message)
	if !validID.MatchString(recipientID) || recipientID == senderID {
		return domain.Connection{}, domain.ErrNotFound
	}
	if utf8.RuneCountInString(message) > 300 {
		return domain.Connection{}, auth.ValidationError{"message": "Mesaj en fazla 300 karakter olabilir."}
	}
	var v [16]byte
	if _, err := rand.Read(v[:]); err != nil {
		return domain.Connection{}, err
	}
	return s.repo.Send(ctx, hex.EncodeToString(v[:]), senderID, recipientID, message)
}

func (s *Service) Inbox(ctx context.Context, userID string) (domain.Inbox, error) {
	return s.repo.Inbox(ctx, userID)
}

func (s *Service) Respond(ctx context.Context, userID, id, action string) (domain.Connection, error) {
	if !validID.MatchString(id) {
		return domain.Connection{}, domain.ErrNotFound
	}
	if action != "accept" && action != "decline" && action != "cancel" {
		return domain.Connection{}, auth.ValidationError{"action": "İşlem accept, decline veya cancel olmalı."}
	}
	return s.repo.Respond(ctx, userID, id, action)
}

func (s *Service) Status(ctx context.Context, userID, otherID string) (domain.PairStatus, error) {
	if !validID.MatchString(otherID) {
		return domain.PairStatus{}, domain.ErrNotFound
	}
	return s.repo.Status(ctx, userID, otherID)
}
