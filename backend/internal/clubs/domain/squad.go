package domain

import (
	"errors"
	"time"
)

var ErrNotMember = errors.New("player is not an active squad member")

// SquadMember is a player in the club's squad, visible to the club only.
type SquadMember struct {
	PlayerID     string    `json:"playerId"`
	Name         string    `json:"name"`
	Position     string    `json:"position"`
	FootballType string    `json:"footballType"`
	JoinedAt     time.Time `json:"joinedAt"`
}

// Membership is a club the player belongs to, visible to the player.
type Membership struct {
	ClubID   string    `json:"clubId"`
	ClubName string    `json:"clubName"`
	District string    `json:"district"`
	JoinedAt time.Time `json:"joinedAt"`
}
