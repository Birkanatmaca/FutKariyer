package domain

import (
	"context"
	"errors"
	"time"
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
