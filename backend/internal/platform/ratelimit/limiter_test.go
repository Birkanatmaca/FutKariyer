package ratelimit

import (
	"testing"
	"time"
)

func TestLimiterWindowPerKey(t *testing.T) {
	now := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	l := New(2, time.Minute)
	l.now = func() time.Time { return now }
	if !l.Allow("a") || !l.Allow("a") || l.Allow("a") {
		t.Fatal("third attempt in the window must be refused")
	}
	if !l.Allow("b") {
		t.Fatal("keys are independent")
	}
	now = now.Add(61 * time.Second)
	if !l.Allow("a") {
		t.Fatal("a new window starts after the old one")
	}
	if len(l.entries) != 1 {
		t.Fatalf("expired keys must be swept, %d left", len(l.entries))
	}
}
