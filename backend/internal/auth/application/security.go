package application

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"
	"unicode/utf8"

	"futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/platform/mail"
	"golang.org/x/crypto/bcrypt"
)

// Account security (20 Oct 2026): password change and reset, email
// verification and active sessions.
const (
	// PasswordCost is the bcrypt cost for new hashes; older hashes are
	// upgraded at the next sign-in.
	PasswordCost = 12
	// SwitchedSessionTTL caps the club session a staff coach opens.
	SwitchedSessionTTL = 8 * time.Hour
	codeTTL            = 15 * time.Minute
	codeCooldown       = time.Minute
	codeAttempts       = 5
)

func validPassword(password string) bool {
	return utf8.RuneCountInString(password) >= 10 && len(password) <= 72
}

const passwordRule = "Şifren en az 10 karakter olmalı ve 72 bayttan uzun olmamalı."

// deviceLabel keeps a short, printable device name from the client.
func deviceLabel(device string) string {
	device = strings.Map(func(r rune) rune {
		if r == utf8.RuneError {
			return -1
		}
		if r < 32 || r == 127 {
			return -1
		}
		return r
	}, strings.TrimSpace(strings.ToValidUTF8(device, "")))
	if utf8.RuneCountInString(device) > 80 {
		device = string([]rune(device)[:80])
	}
	return device
}

// MailEnabled reports whether codes can be emailed on this server.
func (s *Service) MailEnabled() bool { return s.mailer != nil }

// ChangePassword replaces the signed-in account's password after checking the
// current one. Every other session of the account ends; this one stays.
func (s *Service) ChangePassword(ctx context.Context, token, current, next string) error {
	public, err := s.Me(ctx, token)
	if err != nil {
		return err
	}
	if public.Delegate != nil {
		return domain.ErrForbidden
	}
	user, err := s.repo.UserByID(ctx, public.ID)
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(current)) != nil {
		return ValidationError{"currentPassword": "Mevcut şifren doğru değil."}
	}
	if !validPassword(next) {
		return ValidationError{"newPassword": passwordRule}
	}
	if next == current {
		return ValidationError{"newPassword": "Yeni şifren mevcut şifrenden farklı olmalı."}
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(next), PasswordCost)
	if err != nil {
		return err
	}
	return s.repo.ChangePassword(ctx, user.ID, string(hash), HashToken(token))
}

func newCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func codeHash(userID, purpose, code string) string {
	sum := sha256.Sum256([]byte(userID + "\x00" + purpose + "\x00" + code))
	return hex.EncodeToString(sum[:])
}

// sendCode stores a fresh code for the purpose and emails it.
func (s *Service) sendCode(ctx context.Context, user domain.User, purpose string) error {
	if s.mailer == nil {
		return domain.ErrMailUnavailable
	}
	code, err := newCode()
	if err != nil {
		return err
	}
	now := s.now().UTC()
	if err = s.repo.SaveCode(ctx, user.ID, purpose, codeHash(user.ID, purpose, code), now.Add(codeTTL), now, codeCooldown); err != nil {
		return err
	}
	message := mail.Message{To: user.Email}
	switch purpose {
	case domain.PurposeVerifyEmail:
		message.Subject = "Fut Career e-posta doğrulama kodun: " + code
		message.Text = "Merhaba " + user.FullName + ",\n\nFut Career e-posta doğrulama kodun: " + code +
			"\n\nKod 15 dakika geçerlidir. Bu kaydı sen yapmadıysan bu e-postayı yok sayabilirsin.\n\nFut Career"
	case domain.PurposeResetPassword:
		message.Subject = "Fut Career şifre sıfırlama kodun: " + code
		message.Text = "Merhaba " + user.FullName + ",\n\nŞifreni sıfırlamak için kodun: " + code +
			"\n\nKod 15 dakika geçerlidir. Şifre sıfırlamayı sen istemediysen bu e-postayı yok say; şifren değişmez.\n\nFut Career"
	}
	return s.mailer.Send(ctx, message)
}

// SendVerification emails a new verification code to the signed-in account.
func (s *Service) SendVerification(ctx context.Context, token string) error {
	public, err := s.Me(ctx, token)
	if err != nil {
		return err
	}
	if public.Delegate != nil {
		return domain.ErrForbidden
	}
	user, err := s.repo.UserByID(ctx, public.ID)
	if err != nil {
		return err
	}
	if user.EmailVerified || user.Email == "" {
		return nil
	}
	return s.sendCode(ctx, user, domain.PurposeVerifyEmail)
}

// VerifyEmail confirms the signed-in account's email with its code.
func (s *Service) VerifyEmail(ctx context.Context, token, code string) (PublicUser, error) {
	public, err := s.Me(ctx, token)
	if err != nil {
		return PublicUser{}, err
	}
	if public.Delegate != nil {
		return PublicUser{}, domain.ErrForbidden
	}
	if !public.EmailVerified {
		if err = s.repo.UseCode(ctx, public.ID, domain.PurposeVerifyEmail, codeHash(public.ID, domain.PurposeVerifyEmail, strings.TrimSpace(code)), s.now(), codeAttempts); err != nil {
			return PublicUser{}, err
		}
		if err = s.repo.MarkEmailVerified(ctx, public.ID); err != nil {
			return PublicUser{}, err
		}
	}
	return s.Me(ctx, token)
}

// RequireVerifiedEmail refuses self sign-ups (players, coaches) that have not
// verified their email yet, while email sending is configured.
func (s *Service) RequireVerifiedEmail(ctx context.Context, token string) error {
	public, err := s.Me(ctx, token)
	if err != nil {
		return err
	}
	if !public.EmailVerified && (public.Role == "player" || public.Role == "coach") {
		return domain.ErrEmailUnverified
	}
	return nil
}

// ForgotPassword emails a reset code. The answer is the same whether or not
// an account uses the address.
func (s *Service) ForgotPassword(ctx context.Context, email string) error {
	if s.mailer == nil {
		return domain.ErrMailUnavailable
	}
	user, err := s.repo.UserByEmail(ctx, canonicalEmail(email))
	if errors.Is(err, domain.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if !user.Active || user.Role == "admin" {
		return nil
	}
	if err = s.sendCode(ctx, user, domain.PurposeResetPassword); errors.Is(err, domain.ErrCodeTooSoon) {
		return nil
	}
	return err
}

type ResetInput struct {
	Email    string `json:"email"`
	Code     string `json:"code"`
	Password string `json:"password"`
	Device   string `json:"device"`
}

// ResetPassword sets a new password with an emailed code, ends every session
// of the account and signs this device in.
func (s *Service) ResetPassword(ctx context.Context, in ResetInput) (AuthResult, error) {
	if s.mailer == nil {
		return AuthResult{}, domain.ErrMailUnavailable
	}
	if !validPassword(in.Password) {
		return AuthResult{}, ValidationError{"password": passwordRule}
	}
	user, err := s.repo.UserByEmail(ctx, canonicalEmail(in.Email))
	if errors.Is(err, domain.ErrNotFound) {
		return AuthResult{}, domain.ErrCodeInvalid
	}
	if err != nil {
		return AuthResult{}, err
	}
	if !user.Active || user.Role == "admin" {
		return AuthResult{}, domain.ErrCodeInvalid
	}
	if err = s.repo.UseCode(ctx, user.ID, domain.PurposeResetPassword, codeHash(user.ID, domain.PurposeResetPassword, strings.TrimSpace(in.Code)), s.now(), codeAttempts); err != nil {
		return AuthResult{}, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), PasswordCost)
	if err != nil {
		return AuthResult{}, err
	}
	if err = s.repo.ChangePassword(ctx, user.ID, string(hash), ""); err != nil {
		return AuthResult{}, err
	}
	// The code reached the inbox, so the address is proven too.
	if err = s.repo.MarkEmailVerified(ctx, user.ID); err != nil {
		return AuthResult{}, err
	}
	return s.Login(ctx, LoginInput{Email: user.Email, Password: in.Password, Device: in.Device})
}

// SessionView is one live session of the account. ID is derived from the
// token hash and only identifies the session for ending it.
type SessionView struct {
	ID        string    `json:"id"`
	Device    string    `json:"device"`
	CreatedAt time.Time `json:"createdAt"`
	LastSeen  time.Time `json:"lastSeenAt"`
	Current   bool      `json:"current"`
	// Club is set on a club session a coach opened on some device.
	Club bool `json:"club"`
}

func sessionID(tokenHash string) string {
	sum := sha256.Sum256([]byte("session-id\x00" + tokenHash))
	return hex.EncodeToString(sum[:16])
}

// Sessions lists the signed-in account's live sessions.
func (s *Service) Sessions(ctx context.Context, token string) ([]SessionView, error) {
	public, err := s.Me(ctx, token)
	if err != nil {
		return nil, err
	}
	if public.Delegate != nil {
		return nil, domain.ErrForbidden
	}
	list, err := s.repo.Sessions(ctx, public.ID, s.now())
	if err != nil {
		return nil, err
	}
	current := HashToken(token)
	out := make([]SessionView, 0, len(list))
	for _, item := range list {
		out = append(out, SessionView{ID: sessionID(item.TokenHash), Device: item.Device, CreatedAt: item.CreatedAt, LastSeen: item.LastSeen, Current: item.TokenHash == current, Club: item.ActingUserID != ""})
	}
	return out, nil
}

// EndSession signs one of the account's other sessions out.
func (s *Service) EndSession(ctx context.Context, token, id string) error {
	public, err := s.Me(ctx, token)
	if err != nil {
		return err
	}
	if public.Delegate != nil {
		return domain.ErrForbidden
	}
	list, err := s.repo.Sessions(ctx, public.ID, s.now())
	if err != nil {
		return err
	}
	for _, item := range list {
		if sessionID(item.TokenHash) == id {
			return s.repo.DeleteUserSession(ctx, public.ID, item.TokenHash)
		}
	}
	return domain.ErrNotFound
}

// EndOtherSessions signs every other device out.
func (s *Service) EndOtherSessions(ctx context.Context, token string) error {
	public, err := s.Me(ctx, token)
	if err != nil {
		return err
	}
	if public.Delegate != nil {
		return domain.ErrForbidden
	}
	return s.repo.DeleteOtherSessions(ctx, public.ID, HashToken(token))
}
