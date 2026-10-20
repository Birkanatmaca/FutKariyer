package domain

import (
	"context"
	"errors"
	"time"

	"futcareer/backend/internal/platform/audit"
)

var (
	ErrNotFound            = errors.New("not found")
	ErrEmailExists         = errors.New("email already exists")
	ErrUnauthorized        = errors.New("unauthorized")
	ErrUsernameExists      = errors.New("username already exists")
	ErrWrongPortal         = errors.New("wrong login portal")
	ErrPendingApproval     = errors.New("account application awaiting approval")
	ErrApplicationRejected = errors.New("account application rejected")
	// ErrForbidden: the signed-in account may not do this (e.g. a coach acting
	// for a club, or a coach without an active staff link).
	ErrForbidden = errors.New("forbidden")
	// ErrLoginLocked: too many wrong passwords in a row for this account;
	// LoginLockedError says until when.
	ErrLoginLocked = errors.New("login temporarily locked")
	// ErrCodeInvalid: a verification or reset code is wrong, used up or expired.
	ErrCodeInvalid = errors.New("invalid code")
	// ErrCodeTooSoon: a new code was asked for within a minute of the last.
	ErrCodeTooSoon = errors.New("code requested too soon")
	// ErrMailUnavailable: email sending is not configured on this server.
	ErrMailUnavailable = errors.New("mail unavailable")
	// ErrEmailUnverified: the action needs a verified email address.
	ErrEmailUnverified = errors.New("email not verified")
	// ErrTwoFactorRequired: an admin password matched but the second factor
	// is still due (AdminSignIn returns the challenge).
	ErrTwoFactorRequired = errors.New("second factor required")
	// ErrChallengeInvalid: the sign-in step expired, was used up or is unknown.
	ErrChallengeInvalid = errors.New("invalid sign-in challenge")
)

// AdminSecondFactor is an admin's authenticator state.
type AdminSecondFactor struct {
	Sealed   []byte
	Enabled  bool
	LastStep int64
}

// Challenge is a matched admin password waiting for its second factor.
type Challenge struct {
	UserID        string
	PendingSecret []byte
	Attempts      int
}

// LoginLockedError carries when a slowed-down account may try again.
type LoginLockedError struct{ Until time.Time }

func (e LoginLockedError) Error() string { return ErrLoginLocked.Error() }
func (e LoginLockedError) Unwrap() error { return ErrLoginLocked }

// Code purposes.
const (
	PurposeVerifyEmail   = "verify_email"
	PurposeResetPassword = "reset_password"
)

type User struct {
	ID            string
	FullName      string
	Email         string
	Username      string
	Active        bool
	Verified      bool
	AuthVersion   int
	PasswordHash  string
	Role          string
	City          string
	FootballType  string
	LicenseStatus string
	// LicenseLevel is a self-registering coach's declared licence.
	LicenseLevel string
	// ApprovalStatus is approved, pending or rejected; pending and rejected accounts are inactive.
	ApprovalStatus string
	CreatedAt      time.Time
	// EmailVerified is false for a self sign-up that has not entered its code.
	EmailVerified bool
	// LockedUntil is set while repeated wrong passwords slow the account down.
	LockedUntil time.Time
}

type Session struct {
	Audience    string
	AuthVersion int
	TokenHash   string
	UserID      string
	ExpiresAt   time.Time
	// ActingUserID is set on a session a coach opened for a club (UserID);
	// ActingAuthVersion pins the coach's credentials at that moment.
	ActingUserID      string
	ActingAuthVersion int
	// Device is the client's short device label (Active sessions screen).
	Device    string
	CreatedAt time.Time
	LastSeen  time.Time
}

type Repository interface {
	Register(context.Context, User, Session) error
	UserByEmail(context.Context, string) (User, error)
	UserByLogin(context.Context, string) (User, error)
	UserByID(context.Context, string) (User, error)
	CreateSession(context.Context, Session) error
	SessionByHash(context.Context, string) (Session, error)
	DeleteSession(context.Context, string) error
	// StaffPermissions returns the club sections an active staff coach may
	// run, or ErrNotFound when the coach is not active staff of the club.
	StaffPermissions(ctx context.Context, clubID, coachID string) ([]string, error)
	// DeleteUser removes a mobile account; related records cascade or are detached.
	DeleteUser(context.Context, string) error

	// LoginFailed counts a wrong password and returns until when the account
	// is slowed down (zero while under the threshold).
	LoginFailed(ctx context.Context, userID string, now time.Time) (time.Time, error)
	// LoginSucceeded resets the wrong-password count.
	LoginSucceeded(ctx context.Context, userID string) error
	// RehashPassword stores a stronger hash of the same password; sessions stay.
	RehashPassword(ctx context.Context, userID, hash string) error
	// ChangePassword stores a new hash and bumps auth_version, ending every
	// session of the account except keepTokenHash (none when empty), which
	// moves to the new version.
	ChangePassword(ctx context.Context, userID, hash, keepTokenHash string) error
	// SaveCode replaces the account's code for purpose; ErrCodeTooSoon when the
	// previous one was sent less than cooldown ago.
	SaveCode(ctx context.Context, userID, purpose, codeHash string, expires, now time.Time, cooldown time.Duration) error
	// UseCode consumes a matching live code; a wrong guess counts towards
	// maxAttempts and every failure is ErrCodeInvalid.
	UseCode(ctx context.Context, userID, purpose, codeHash string, now time.Time, maxAttempts int) error
	MarkEmailVerified(ctx context.Context, userID string) error
	// Sessions lists the account's live sessions, newest use first.
	Sessions(ctx context.Context, userID string, now time.Time) ([]Session, error)
	// DeleteUserSession ends one session of the account by its hash.
	DeleteUserSession(ctx context.Context, userID, tokenHash string) error
	// DeleteOtherSessions ends every session of the account except keepTokenHash.
	DeleteOtherSessions(ctx context.Context, userID, keepTokenHash string) error
	// TouchSession records use at most every few minutes.
	TouchSession(ctx context.Context, tokenHash string, now time.Time) error

	// Admin second factor (20 Oct 2026).
	SecondFactor(ctx context.Context, userID string) (AdminSecondFactor, error)
	CreateChallenge(ctx context.Context, tokenHash, userID string, pendingSecret []byte, expires time.Time) error
	// Challenge returns a live challenge or ErrChallengeInvalid.
	Challenge(ctx context.Context, tokenHash string, now time.Time) (Challenge, error)
	ChallengeFailed(ctx context.Context, tokenHash string) error
	DeleteChallenge(ctx context.Context, tokenHash string) error
	// EnableSecondFactor stores the sealed key, the step just used and the
	// hashes of fresh recovery codes (replacing older ones).
	EnableSecondFactor(ctx context.Context, userID string, sealed []byte, step int64, recoveryHashes []string) error
	// UseStep records a step as used; false when it was not newer.
	UseStep(ctx context.Context, userID string, step int64) (bool, error)
	// UseRecoveryCode spends an unused recovery code; false when none matched.
	UseRecoveryCode(ctx context.Context, userID, codeHash string) (bool, error)
	// ResetSecondFactor removes an admin's authenticator and recovery codes
	// and ends their sessions (server command for a lost phone).
	ResetSecondFactor(ctx context.Context, login string) error
	// Audit appends to the audit log.
	Audit(ctx context.Context, entry audit.Entry) error
}

// Application is a club or organizer sign-up waiting for administrator review.
type Application struct {
	ContactName  string
	Phone        string
	District     string
	Note         string
	FootballType string
}

// ApplicationRepository stores self-service club and organizer applications.
type ApplicationRepository interface {
	Apply(context.Context, User, Application) error
}
