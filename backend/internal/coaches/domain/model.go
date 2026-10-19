package domain

import (
	"context"
	"errors"
	"slices"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	ErrNotFound = errors.New("not found")
	// ErrExists: the coach is already invited to or working for the club.
	ErrExists = errors.New("already staff")
	// ErrStaffLimit: a club keeps at most MaxStaff coaches and invitations.
	ErrStaffLimit = errors.New("staff limit reached")
)

const MaxStaff = 20

// Values a coach declares; specialties double as staff roles in a club.
var (
	LicenseLevels  = []string{"unknown", "uefa_pro", "uefa_a", "uefa_b", "uefa_c", "grassroots", "none"}
	Specialties    = []string{"head_coach", "assistant", "goalkeeper", "fitness", "youth", "analyst"}
	FootballTypes  = []string{"unknown", "amateur", "professional", "halisaha"}
	Availabilities = []string{"seeking_team", "open_to_offers", "not_available"}
	// Permissions are the club sections a switched coach may run.
	Permissions = []string{"applications", "squad", "listings", "news", "tournaments", "profile", "social"}
)

// Visibility says which groups the coach shows on the public profile; clubs
// always see everything.
type Visibility struct {
	License    bool `json:"license"`
	Experience bool `json:"experience"`
	Football   bool `json:"football"`
	Clubs      bool `json:"clubs"`
}

// Profile is everything a coach declares about their football work.
type Profile struct {
	LicenseLevel    string     `json:"licenseLevel"`
	Specialties     []string   `json:"specialties"`
	ExperienceYears int        `json:"experienceYears"`
	FootballType    string     `json:"footballType"`
	Availability    string     `json:"availability"`
	PastClubs       []string   `json:"pastClubs"`
	Visibility      Visibility `json:"visibility"`
}

func EmptyProfile() Profile {
	return Profile{LicenseLevel: "unknown", Specialties: []string{}, FootballType: "unknown", Availability: "not_available", PastClubs: []string{}}
}

// PublicProfile is the part of a profile the coach chose to show; hidden
// groups are left out entirely.
type PublicProfile struct {
	LicenseLevel    string   `json:"licenseLevel,omitempty"`
	Specialties     []string `json:"specialties,omitempty"`
	ExperienceYears *int     `json:"experienceYears,omitempty"`
	FootballType    string   `json:"footballType,omitempty"`
	Availability    string   `json:"availability,omitempty"`
	PastClubs       []string `json:"pastClubs,omitempty"`
	ShowClubs       bool     `json:"showClubs"`
}

func (p Profile) Public() PublicProfile {
	var out PublicProfile
	if p.Visibility.License {
		out.LicenseLevel = p.LicenseLevel
	}
	if p.Visibility.Experience {
		years := p.ExperienceYears
		out.Specialties, out.ExperienceYears = p.Specialties, &years
	}
	if p.Visibility.Football {
		out.FootballType, out.Availability = p.FootballType, p.Availability
	}
	if p.Visibility.Clubs {
		out.PastClubs, out.ShowClubs = p.PastClubs, true
	}
	return out
}

type ValidationError map[string]string

func (v ValidationError) Error() string {
	for _, message := range v {
		return message
	}
	return "Bilgiler geçersiz."
}

// Normalize trims and validates a profile before it is saved.
func Normalize(p Profile) (Profile, error) {
	fields := ValidationError{}
	if !slices.Contains(LicenseLevels, p.LicenseLevel) {
		fields["licenseLevel"] = "Geçerli bir lisans seç."
	}
	specialties := []string{}
	for _, s := range p.Specialties {
		if !slices.Contains(Specialties, s) {
			fields["specialties"] = "Geçerli uzmanlıklar seç."
		} else if !slices.Contains(specialties, s) {
			specialties = append(specialties, s)
		}
	}
	if p.ExperienceYears < 0 || p.ExperienceYears > 60 {
		fields["experienceYears"] = "Deneyim 0–60 yıl arasında olmalı."
	}
	if !slices.Contains(FootballTypes, p.FootballType) {
		fields["footballType"] = "Geçerli bir futbol türü seç."
	}
	if !slices.Contains(Availabilities, p.Availability) {
		fields["availability"] = "Geçerli bir durum seç."
	}
	clubs := []string{}
	for _, name := range p.PastClubs {
		name = strings.Join(strings.Fields(name), " ")
		if name == "" {
			continue
		}
		if n := utf8.RuneCountInString(name); n < 2 || n > 60 {
			fields["pastClubs"] = "Kulüp adları 2–60 karakter olmalı."
		}
		clubs = append(clubs, name)
	}
	if len(clubs) > 10 {
		fields["pastClubs"] = "En fazla 10 kulüp ekleyebilirsin."
	}
	if len(fields) > 0 {
		return p, fields
	}
	p.Specialties, p.PastClubs = specialties, clubs
	return p, nil
}

// NormalizeGrant validates the role and section permissions a club gives.
func NormalizeGrant(role string, permissions []string) (string, []string, error) {
	if !slices.Contains(Specialties, role) {
		return "", nil, ValidationError{"role": "Geçerli bir görev seç."}
	}
	out := []string{}
	for _, permission := range permissions {
		if !slices.Contains(Permissions, permission) {
			return "", nil, ValidationError{"permissions": "Geçerli izinler seç."}
		}
		if !slices.Contains(out, permission) {
			out = append(out, permission)
		}
	}
	return role, out, nil
}

// Person is the public face of an account in staff lists.
type Person struct {
	ID            string `json:"id"`
	FullName      string `json:"fullName"`
	Verified      bool   `json:"verified"`
	District      string `json:"district"`
	AvatarVersion int    `json:"avatarVersion"`
}

// Member is a coach on (or invited to) a club's technical staff, as the club
// sees it: with the full declared profile.
type Member struct {
	Coach       Person     `json:"coach"`
	Status      string     `json:"status"`
	Role        string     `json:"role"`
	Permissions []string   `json:"permissions"`
	InvitedAt   time.Time  `json:"invitedAt"`
	JoinedAt    *time.Time `json:"joinedAt"`
	Profile     Profile    `json:"profile"`
}

// Membership is a club link as the coach sees it.
type Membership struct {
	Club        Person     `json:"club"`
	Status      string     `json:"status"`
	Role        string     `json:"role"`
	Permissions []string   `json:"permissions"`
	InvitedAt   time.Time  `json:"invitedAt"`
	JoinedAt    *time.Time `json:"joinedAt"`
}

// Candidate is a coach a club can invite.
type Candidate struct {
	Coach   Person  `json:"coach"`
	Profile Profile `json:"profile"`
}

// StaffCard is an active staff member on a club's public page.
type StaffCard struct {
	Coach Person `json:"coach"`
	Role  string `json:"role"`
}

// ClubCard is a club a coach works for, on the coach's public profile.
type ClubCard struct {
	Club Person `json:"club"`
	Role string `json:"role"`
}

type Repository interface {
	Profile(ctx context.Context, coachID string) (Profile, error)
	SaveProfile(ctx context.Context, coachID string, p Profile) (Profile, error)
	Staff(ctx context.Context, clubID string) ([]Member, error)
	Candidates(ctx context.Context, clubID, query string) ([]Candidate, error)
	Invite(ctx context.Context, clubID, coachID, role string, permissions []string) error
	UpdateMember(ctx context.Context, clubID, coachID, role string, permissions []string) error
	RemoveMember(ctx context.Context, clubID, coachID string) error
	Memberships(ctx context.Context, coachID string) ([]Membership, error)
	Respond(ctx context.Context, coachID, clubID string, accept bool) error
	Leave(ctx context.Context, coachID, clubID string) error
	PublicStaff(ctx context.Context, clubID string) ([]StaffCard, error)
	// ActiveClubs lists the clubs a coach works for, for their public profile.
	ActiveClubs(ctx context.Context, coachID string) ([]ClubCard, error)
}
