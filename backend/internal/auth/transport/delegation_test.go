package transport

import (
	"net/http/httptest"
	"testing"
)

// Every rule of the switched-session policy, one row per request.
func TestDelegationPolicy(t *testing.T) {
	all := []string{"applications", "squad", "listings", "news", "tournaments", "profile", "social"}
	cases := []struct {
		method, path string
		permissions  []string
		want         bool
	}{
		// The club's private areas stay closed even with every permission.
		{"GET", "/v1/connections", all, false},
		{"GET", "/v1/connections/with/abc", all, false},
		{"POST", "/v1/connections", all, false},
		{"GET", "/v1/me/profile-visitors", all, false},
		{"GET", "/v1/me/blocks", all, false},
		{"GET", "/v1/me/staff", all, false},
		{"GET", "/v1/me/staff/candidates", all, false},
		{"GET", "/v1/gifts", all, false},
		{"GET", "/v1/me/pro", all, false},
		{"GET", "/v1/me/pro-payments", all, false},
		{"GET", "/v1/me/team-request-payments", all, false},
		{"GET", "/v1/me/store-orders", all, false},
		{"POST", "/v1/me/store-purchases", all, false},
		{"PUT", "/v1/me/push-devices", all, false},
		{"GET", "/v1/me/sessions", all, false},
		{"PUT", "/v1/me/password", all, false},
		// Section reads and writes follow the club's grant.
		{"GET", "/v1/me/squad", []string{"squad"}, true},
		{"GET", "/v1/me/squad", []string{"news"}, false},
		{"POST", "/v1/me/squad/abc", []string{"squad"}, true},
		{"GET", "/v1/teams/me/join-requests", []string{"applications"}, true},
		{"GET", "/v1/teams/me/join-requests", nil, false},
		{"PUT", "/v1/me/club-profile", []string{"profile"}, true},
		{"PUT", "/v1/me/club-profile", nil, false},
		{"POST", "/v1/social/posts", []string{"social"}, true},
		{"POST", "/v1/social/posts", nil, false},
		{"POST", "/v1/tournaments/abc/entries", []string{"tournaments"}, true},
		// Other reads are open; other writes are refused by default.
		{"GET", "/v1/me/profile", nil, true},
		{"GET", "/v1/me/notifications", nil, true},
		{"GET", "/v1/leagues", nil, true},
		{"PUT", "/v1/me/profile", all, false},
		{"PUT", "/v1/me/avatar", all, false},
		{"DELETE", "/v1/auth/account", all, false},
		{"POST", "/v1/auth/switch", all, false},
		// Leaving and marking notifications read always work.
		{"POST", "/v1/auth/logout", nil, true},
		{"PUT", "/v1/me/notifications/read-all", nil, true},
	}
	for _, c := range cases {
		r := httptest.NewRequest(c.method, c.path, nil)
		if got := allowed(r, c.permissions); got != c.want {
			t.Errorf("%s %s with %v: allowed=%v, want %v", c.method, c.path, c.permissions, got, c.want)
		}
	}
}
