package application

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"futcareer/backend/internal/auth/domain"
	"golang.org/x/crypto/bcrypt"
)

type ValidationError map[string]string

func (e ValidationError) Error() string { return "Bilgilerini kontrol edip tekrar dene." }

type RegisterInput struct {
	FullName       string `json:"fullName"`
	Email          string `json:"email"`
	Password       string `json:"password"`
	Role           string `json:"role"`
	AdultConfirmed bool   `json:"adultConfirmed"`
}
type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}
type PublicUser struct {
	ID        string    `json:"id"`
	FullName  string    `json:"fullName"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	City      string    `json:"city"`
	CreatedAt time.Time `json:"createdAt"`
}
type AuthResult struct {
	Token     string     `json:"token"`
	ExpiresAt time.Time  `json:"expiresAt"`
	User      PublicUser `json:"user"`
}
type Service struct {
	repo      domain.Repository
	ttl       time.Duration
	dummyHash []byte
	now       func() time.Time
}

func New(repo domain.Repository, ttl time.Duration) *Service {
	dummy, _ := bcrypt.GenerateFromPassword([]byte("unusable-placeholder-password"), bcrypt.DefaultCost)
	return &Service{repo: repo, ttl: ttl, dummyHash: dummy, now: time.Now}
}
func public(u domain.User) PublicUser {
	return PublicUser{ID: u.ID, FullName: u.FullName, Email: u.Email, Role: u.Role, City: u.City, CreatedAt: u.CreatedAt}
}
func canonicalEmail(email string) string { return strings.ToLower(strings.TrimSpace(email)) }
func validEmail(email string) bool {
	parsed, err := mail.ParseAddress(email)
	return err == nil && parsed.Address == email && len(email) <= 254 && strings.Contains(strings.SplitN(email, "@", 2)[1], ".")
}
func (s *Service) Register(ctx context.Context, in RegisterInput) (AuthResult, error) {
	in.FullName = strings.TrimSpace(in.FullName)
	in.Email = canonicalEmail(in.Email)
	fields := ValidationError{}
	if n := utf8.RuneCountInString(in.FullName); n < 2 || n > 80 {
		fields["fullName"] = "Adın 2–80 karakter arasında olmalı."
	}
	if !validEmail(in.Email) {
		fields["email"] = "Geçerli bir e-posta adresi gir."
	}
	if utf8.RuneCountInString(in.Password) < 10 || len(in.Password) > 72 {
		fields["password"] = "Şifren en az 10 karakter olmalı ve 72 bayttan uzun olmamalı."
	}
	if in.Role != "player" && in.Role != "coach" && in.Role != "club" {
		fields["role"] = "Hesap türünü seç."
	}
	if !in.AdultConfirmed {
		fields["adultConfirmed"] = "Ankara pilotuna yalnızca 18 yaş ve üzeri kişiler katılabilir."
	}
	if len(fields) > 0 {
		return AuthResult{}, fields
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return AuthResult{}, err
	}
	idBytes := make([]byte, 16)
	if _, err = rand.Read(idBytes); err != nil {
		return AuthResult{}, err
	}
	user := domain.User{ID: hex.EncodeToString(idBytes), FullName: in.FullName, Email: in.Email, PasswordHash: string(hash), Role: in.Role, City: "Ankara", AdultConfirmed: true, CreatedAt: s.now().UTC()}
	token, session, err := s.newSession(user.ID)
	if err != nil {
		return AuthResult{}, err
	}
	if err = s.repo.Register(ctx, user, session); err != nil {
		return AuthResult{}, err
	}
	return AuthResult{Token: token, ExpiresAt: session.ExpiresAt, User: public(user)}, nil
}
func (s *Service) Login(ctx context.Context, in LoginInput) (AuthResult, error) {
	user, err := s.repo.UserByEmail(ctx, canonicalEmail(in.Email))
	if errors.Is(err, domain.ErrNotFound) {
		_ = bcrypt.CompareHashAndPassword(s.dummyHash, []byte(in.Password))
		return AuthResult{}, domain.ErrUnauthorized
	}
	if err != nil {
		return AuthResult{}, err
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(in.Password)) != nil {
		return AuthResult{}, domain.ErrUnauthorized
	}
	token, session, err := s.newSession(user.ID)
	if err != nil {
		return AuthResult{}, err
	}
	if err = s.repo.CreateSession(ctx, session); err != nil {
		return AuthResult{}, err
	}
	return AuthResult{Token: token, ExpiresAt: session.ExpiresAt, User: public(user)}, nil
}
func (s *Service) Me(ctx context.Context, token string) (PublicUser, error) {
	if len(token) != 43 {
		return PublicUser{}, domain.ErrUnauthorized
	}
	session, err := s.repo.SessionByHash(ctx, HashToken(token))
	if errors.Is(err, domain.ErrNotFound) {
		return PublicUser{}, domain.ErrUnauthorized
	}
	if err != nil {
		return PublicUser{}, err
	}
	if !session.ExpiresAt.After(s.now()) {
		return PublicUser{}, domain.ErrUnauthorized
	}
	user, err := s.repo.UserByID(ctx, session.UserID)
	if errors.Is(err, domain.ErrNotFound) {
		return PublicUser{}, domain.ErrUnauthorized
	}
	if err != nil {
		return PublicUser{}, err
	}
	return public(user), nil
}
func (s *Service) Logout(ctx context.Context, token string) error {
	return s.repo.DeleteSession(ctx, HashToken(token))
}
func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
func (s *Service) newSession(userID string) (string, domain.Session, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", domain.Session{}, err
	}
	token := base64.RawURLEncoding.EncodeToString(bytes)
	return token, domain.Session{TokenHash: HashToken(token), UserID: userID, ExpiresAt: s.now().UTC().Add(s.ttl)}, nil
}
