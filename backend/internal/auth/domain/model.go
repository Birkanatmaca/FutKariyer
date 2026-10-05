package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound     = errors.New("not found")
	ErrEmailExists  = errors.New("email already exists")
	ErrUnauthorized = errors.New("unauthorized")
)

type User struct {
	ID             string
	FullName       string
	Email          string
	PasswordHash   string
	Role           string
	City           string
	AdultConfirmed bool
	CreatedAt      time.Time
}

type Session struct {
	TokenHash string
	UserID    string
	ExpiresAt time.Time
}

type Repository interface {
	Register(context.Context, User, Session) error
	UserByEmail(context.Context, string) (User, error)
	UserByID(context.Context, string) (User, error)
	CreateSession(context.Context, Session) error
	SessionByHash(context.Context, string) (Session, error)
	DeleteSession(context.Context, string) error
}
