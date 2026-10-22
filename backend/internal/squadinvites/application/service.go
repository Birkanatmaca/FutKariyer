package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"regexp"
	"strings"
	"unicode/utf8"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/squadinvites/domain"
)

var validID = regexp.MustCompile(`^[a-f0-9]{32}$`)

type Service struct{ repo domain.Repository }

func New(repo domain.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Candidates(ctx context.Context, clubID, search string) ([]domain.Candidate, error) {
	search = strings.TrimSpace(search)
	if n := utf8.RuneCountInString(search); n < 2 || n > 80 {
		return nil, auth.ValidationError{"q": "Aramak için en az 2 harf yaz."}
	}
	return s.repo.Candidates(ctx, clubID, search)
}

func (s *Service) ClubInvites(ctx context.Context, clubID string) ([]domain.Invite, error) {
	return s.repo.ClubInvites(ctx, clubID)
}

func (s *Service) Invite(ctx context.Context, clubID, playerID, message string) (domain.Invite, error) {
	message = strings.TrimSpace(message)
	fields := auth.ValidationError{}
	if !validID.MatchString(playerID) {
		fields["playerId"] = "Davet edilecek oyuncuyu seç."
	}
	if utf8.RuneCountInString(message) > 300 {
		fields["message"] = "Mesaj en fazla 300 karakter olabilir."
	}
	if len(fields) > 0 {
		return domain.Invite{}, fields
	}
	var v [16]byte
	if _, err := rand.Read(v[:]); err != nil {
		return domain.Invite{}, err
	}
	return s.repo.Invite(ctx, clubID, playerID, hex.EncodeToString(v[:]), message)
}

func (s *Service) Cancel(ctx context.Context, clubID, id string) (domain.Invite, error) {
	if !validID.MatchString(id) {
		return domain.Invite{}, domain.ErrNotFound
	}
	return s.repo.Cancel(ctx, clubID, id)
}

func (s *Service) PlayerInvites(ctx context.Context, playerID string) ([]domain.Invite, error) {
	return s.repo.PlayerInvites(ctx, playerID)
}

func (s *Service) Respond(ctx context.Context, playerID, id, decision string) (domain.Invite, error) {
	if !validID.MatchString(id) {
		return domain.Invite{}, domain.ErrNotFound
	}
	if decision != "accept" && decision != "decline" {
		return domain.Invite{}, auth.ValidationError{"decision": "Karar accept veya decline olmalı."}
	}
	return s.repo.Respond(ctx, playerID, id, decision == "accept")
}
