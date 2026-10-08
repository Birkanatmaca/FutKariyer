package domain

import "time"

// The account is the club identity; its name and login credentials live in users.
type Club struct {
	UserID    string
	District  string
	UpdatedAt time.Time
}
