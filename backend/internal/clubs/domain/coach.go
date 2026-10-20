package domain

// StaffLink is an active place on a club's technical staff.
type StaffLink struct {
	ClubID        string
	ClubName      string
	AvatarVersion int
	District      string
	Role          string
	Permissions   []string
}

// CoachTeam is one club a coach works for, as the coach's Takımım page shows
// it (20 Oct 2026): the club, the coach's role and rights, the work and the
// club's main league.
type CoachTeam struct {
	ClubID        string   `json:"clubId"`
	ClubName      string   `json:"clubName"`
	AvatarVersion int      `json:"avatarVersion"`
	District      string   `json:"district"`
	Role          string   `json:"role"`
	Permissions   []string `json:"permissions"`
	// PendingApplications is counted only for coaches with the applications right.
	PendingApplications int         `json:"pendingApplications"`
	SquadCount          int         `json:"squadCount"`
	TFFLinked           bool        `json:"tffLinked"`
	League              *LeagueView `json:"league"`
}

// CoachTeams lists the coach's clubs and how many invitations wait.
type CoachTeams struct {
	Teams       []CoachTeam `json:"teams"`
	Invitations int         `json:"invitations"`
}
