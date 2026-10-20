package application_test

import (
	"context"
	"errors"
	"regexp"
	"sync"
	"testing"
	"time"

	"futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/auth/data"
	"futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/platform/mail"
	"futcareer/backend/internal/testsupport/testpostgres"
	"golang.org/x/crypto/bcrypt"
)

type inbox struct {
	mu   sync.Mutex
	sent []mail.Message
}

func (i *inbox) Send(_ context.Context, m mail.Message) error {
	i.mu.Lock()
	defer i.mu.Unlock()
	i.sent = append(i.sent, m)
	return nil
}

var sixDigits = regexp.MustCompile(`\b\d{6}\b`)

func (i *inbox) lastCode(t *testing.T) string {
	t.Helper()
	i.mu.Lock()
	defer i.mu.Unlock()
	if len(i.sent) == 0 {
		t.Fatal("no email sent")
	}
	code := sixDigits.FindString(i.sent[len(i.sent)-1].Text)
	if code == "" {
		t.Fatal("email without a code")
	}
	return code
}

func wrongCode(code string) string {
	if code == "000000" {
		return "111111"
	}
	return "000000"
}

func register(t *testing.T, svc *application.Service, email string) application.AuthResult {
	t.Helper()
	result, err := svc.Register(context.Background(), application.RegisterInput{FullName: "Deniz Kaya", Email: email, Password: "strong-password-123", Role: "player", FootballType: "amateur", LicenseStatus: "licensed", Device: "iPhone 15"})
	if err != nil {
		t.Fatal(err)
	}
	return result
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestChangePasswordKeepsOnlyThisSession(t *testing.T) {
	db := testpostgres.New(t)
	repo := data.New(db.DB)
	svc := application.New(repo, time.Hour)
	ctx := context.Background()
	first := register(t, svc, "deniz@example.com")
	second, err := svc.Login(ctx, application.LoginInput{Email: "deniz@example.com", Password: "strong-password-123", Device: "iPad"})
	if err != nil {
		t.Fatal(err)
	}
	var fields application.ValidationError
	if err = svc.ChangePassword(ctx, first.Token, "wrong-password-1", "new-password-456"); !errors.As(err, &fields) || fields["currentPassword"] == "" {
		t.Fatalf("wrong current password: %v", err)
	}
	if err = svc.ChangePassword(ctx, first.Token, "strong-password-123", "short"); !errors.As(err, &fields) || fields["newPassword"] == "" {
		t.Fatalf("weak new password: %v", err)
	}
	if err = svc.ChangePassword(ctx, first.Token, "strong-password-123", "new-password-456"); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.Me(ctx, first.Token); err != nil {
		t.Fatalf("the changing session must stay: %v", err)
	}
	if _, err = svc.Me(ctx, second.Token); !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("other sessions must end: %v", err)
	}
	if _, err = svc.Login(ctx, application.LoginInput{Email: "deniz@example.com", Password: "new-password-456"}); err != nil {
		t.Fatalf("new password: %v", err)
	}
	user, _ := repo.UserByEmail(ctx, "deniz@example.com")
	if cost, _ := bcrypt.Cost([]byte(user.PasswordHash)); cost != application.PasswordCost {
		t.Fatalf("hash cost %d", cost)
	}
}

func TestWrongPasswordsSlowTheAccountDown(t *testing.T) {
	db := testpostgres.New(t)
	repo := data.New(db.DB)
	svc := application.New(repo, time.Hour)
	ctx := context.Background()
	register(t, svc, "deniz@example.com")
	wrong := application.LoginInput{Email: "deniz@example.com", Password: "wrong-password-0"}
	for i := 0; i < 4; i++ {
		if _, err := svc.Login(ctx, wrong); !errors.Is(err, domain.ErrUnauthorized) {
			t.Fatalf("miss %d: %v", i+1, err)
		}
	}
	_, err := svc.Login(ctx, wrong)
	var locked domain.LoginLockedError
	if !errors.As(err, &locked) || time.Until(locked.Until) < 50*time.Second {
		t.Fatalf("fifth miss must slow down: %v", err)
	}
	// While slowed down even the right password waits.
	if _, err = svc.Login(ctx, application.LoginInput{Email: "deniz@example.com", Password: "strong-password-123"}); !errors.Is(err, domain.ErrLoginLocked) {
		t.Fatalf("locked account signed in: %v", err)
	}
	if _, err = db.DB.Exec(`UPDATE users SET login_locked_until=now()-interval '1 second'`); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.Login(ctx, application.LoginInput{Email: "deniz@example.com", Password: "strong-password-123"}); err != nil {
		t.Fatalf("after the wait: %v", err)
	}
	var failures int
	if err = db.DB.QueryRow(`SELECT failed_logins FROM users`).Scan(&failures); err != nil || failures != 0 {
		t.Fatalf("success must reset the count: %d %v", failures, err)
	}
}

func TestOldHashesAreUpgradedAtSignIn(t *testing.T) {
	db := testpostgres.New(t)
	repo := data.New(db.DB)
	svc := application.New(repo, time.Hour)
	ctx := context.Background()
	register(t, svc, "deniz@example.com")
	old, _ := bcrypt.GenerateFromPassword([]byte("strong-password-123"), bcrypt.DefaultCost)
	if _, err := db.DB.Exec(`UPDATE users SET password_hash=$1`, string(old)); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Login(ctx, application.LoginInput{Email: "deniz@example.com", Password: "strong-password-123"}); err != nil {
		t.Fatal(err)
	}
	user, _ := repo.UserByEmail(ctx, "deniz@example.com")
	if cost, _ := bcrypt.Cost([]byte(user.PasswordHash)); cost != application.PasswordCost {
		t.Fatalf("hash not upgraded: cost %d", cost)
	}
}

func TestEmailVerificationAndPasswordReset(t *testing.T) {
	db := testpostgres.New(t)
	repo := data.New(db.DB)
	mails := &inbox{}
	svc := application.New(repo, time.Hour).WithMailer(mails)
	ctx := context.Background()
	signup := register(t, svc, "deniz@example.com")
	if signup.User.EmailVerified {
		t.Fatal("a new sign-up starts unverified while mail is on")
	}
	if err := svc.RequireVerifiedEmail(ctx, signup.Token); !errors.Is(err, domain.ErrEmailUnverified) {
		t.Fatalf("unverified account passed the gate: %v", err)
	}
	code := mails.lastCode(t)
	if err := svc.SendVerification(ctx, signup.Token); !errors.Is(err, domain.ErrCodeTooSoon) {
		t.Fatalf("resend within a minute: %v", err)
	}
	if _, err := svc.VerifyEmail(ctx, signup.Token, wrongCode(code)); !errors.Is(err, domain.ErrCodeInvalid) {
		t.Fatalf("wrong code: %v", err)
	}
	user, err := svc.VerifyEmail(ctx, signup.Token, code)
	if err != nil || !user.EmailVerified {
		t.Fatalf("verify: %+v %v", user, err)
	}
	if _, err = svc.VerifyEmail(ctx, signup.Token, code); err != nil {
		t.Fatalf("verifying again is a no-op: %v", err)
	}

	// Reset: unknown addresses get the same answer and no email.
	sent := len(mails.sent)
	if err = svc.ForgotPassword(ctx, "nobody@example.com"); err != nil || len(mails.sent) != sent {
		t.Fatalf("unknown address: %v, %d mails", err, len(mails.sent)-sent)
	}
	if err = svc.ForgotPassword(ctx, " DENIZ@example.com "); err != nil {
		t.Fatal(err)
	}
	reset := mails.lastCode(t)
	// Five wrong guesses use the code up.
	for i := 0; i < 5; i++ {
		if _, err = svc.ResetPassword(ctx, application.ResetInput{Email: "deniz@example.com", Code: wrongCode(reset), Password: "brand-new-pass-1"}); !errors.Is(err, domain.ErrCodeInvalid) {
			t.Fatalf("guess %d: %v", i+1, err)
		}
	}
	if _, err = svc.ResetPassword(ctx, application.ResetInput{Email: "deniz@example.com", Code: reset, Password: "brand-new-pass-1"}); !errors.Is(err, domain.ErrCodeInvalid) {
		t.Fatalf("a used-up code must not work: %v", err)
	}
	if _, err = db.DB.Exec(`UPDATE auth_codes SET sent_at=now()-interval '2 minutes'`); err != nil {
		t.Fatal(err)
	}
	if err = svc.ForgotPassword(ctx, "deniz@example.com"); err != nil {
		t.Fatal(err)
	}
	reset = mails.lastCode(t)
	result, err := svc.ResetPassword(ctx, application.ResetInput{Email: "deniz@example.com", Code: reset, Password: "brand-new-pass-1", Device: "Pixel"})
	if err != nil || result.Token == "" {
		t.Fatalf("reset: %v", err)
	}
	if _, err = svc.Me(ctx, signup.Token); !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("reset must end the old sessions: %v", err)
	}
	if _, err = svc.ResetPassword(ctx, application.ResetInput{Email: "deniz@example.com", Code: reset, Password: "another-pass-22"}); !errors.Is(err, domain.ErrCodeInvalid) {
		t.Fatalf("a code works once: %v", err)
	}
}

func TestWithoutMailNothingIsGated(t *testing.T) {
	db := testpostgres.New(t)
	svc := application.New(data.New(db.DB), time.Hour)
	ctx := context.Background()
	signup := register(t, svc, "deniz@example.com")
	if !signup.User.EmailVerified {
		t.Fatal("without mail nobody can verify, so nobody is asked to")
	}
	if err := svc.RequireVerifiedEmail(ctx, signup.Token); err != nil {
		t.Fatal(err)
	}
	if err := svc.ForgotPassword(ctx, "deniz@example.com"); !errors.Is(err, domain.ErrMailUnavailable) {
		t.Fatalf("forgot without mail: %v", err)
	}
}

func TestActiveSessions(t *testing.T) {
	db := testpostgres.New(t)
	svc := application.New(data.New(db.DB), time.Hour)
	ctx := context.Background()
	phone := register(t, svc, "deniz@example.com")
	tablet, err := svc.Login(ctx, application.LoginInput{Email: "deniz@example.com", Password: "strong-password-123", Device: "iPad"})
	if err != nil {
		t.Fatal(err)
	}
	laptop, err := svc.Login(ctx, application.LoginInput{Email: "deniz@example.com", Password: "strong-password-123", Device: "Pixel 8"})
	if err != nil {
		t.Fatal(err)
	}
	list, err := svc.Sessions(ctx, phone.Token)
	if err != nil || len(list) != 3 {
		t.Fatalf("sessions: %+v %v", list, err)
	}
	var tabletID string
	current := 0
	for _, s := range list {
		if s.Current {
			current++
			if s.Device != "iPhone 15" {
				t.Fatalf("current device: %q", s.Device)
			}
		}
		if s.Device == "iPad" {
			tabletID = s.ID
		}
	}
	if current != 1 || tabletID == "" {
		t.Fatalf("list: %+v", list)
	}
	if err = svc.EndSession(ctx, phone.Token, tabletID); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.Me(ctx, tablet.Token); !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatal("ended session still works")
	}
	if err = svc.EndOtherSessions(ctx, phone.Token); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.Me(ctx, laptop.Token); !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatal("other sessions must end")
	}
	if _, err = svc.Me(ctx, phone.Token); err != nil {
		t.Fatal("this session must stay")
	}
}
