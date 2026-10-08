package domain

import (
	"context"
	"errors"

	auth "futcareer/backend/internal/auth/domain"
	clubs "futcareer/backend/internal/clubs/domain"
)

var ErrProtected = errors.New("admin account is protected")
var ErrAdminExists = errors.New("initial admin already exists")

type Record struct {
	User auth.User
	Club *clubs.Club
}
type Query struct {
	Page      int
	PageSize  int
	Search    string
	ClubsOnly bool
}
type Page struct {
	Items []Record
	Total int
}
type Repository interface {
	List(context.Context, Query) (Page, error)
	Get(context.Context, string) (Record, error)
	Create(context.Context, Record) error
	Update(context.Context, Record) error
	Delete(context.Context, string) error
	ResetPassword(context.Context, string, string) error
	Bootstrap(context.Context, auth.User) error
}
