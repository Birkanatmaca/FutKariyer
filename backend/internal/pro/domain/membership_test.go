package domain

import (
	"testing"
	"time"
)

func TestExtendStacksFromLaterOfNowAndExpiry(t *testing.T) {
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	if got := Extend(now, nil, PeriodDays); !got.Equal(now.AddDate(0, 0, 30)) {
		t.Fatalf("first activation: %v", got)
	}
	past := now.AddDate(0, 0, -3)
	if got := Extend(now, &past, PeriodDays); !got.Equal(now.AddDate(0, 0, 30)) {
		t.Fatalf("expired membership restarts from now: %v", got)
	}
	future := now.AddDate(0, 0, 10)
	if got := Extend(now, &future, PeriodDays); !got.Equal(now.AddDate(0, 0, 40)) {
		t.Fatalf("renewal stacks on current expiry: %v", got)
	}
}

func TestEligibleRoles(t *testing.T) {
	for role, want := range map[string]bool{"player": true, "club": true, "coach": true, "organizer": false, "admin": false, "": false} {
		if EligibleRole(role) != want {
			t.Fatalf("%s eligible=%v", role, !want)
		}
	}
}
