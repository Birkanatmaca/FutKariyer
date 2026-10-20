package ratelimit

import (
	"sync"
	"time"
)

type bucket struct {
	start    time.Time
	attempts int
}

// Limiter allows limit attempts per key in a fixed window. Expired keys are
// swept at most once per window, not on every call.
type Limiter struct {
	mu        sync.Mutex
	entries   map[string]bucket
	limit     int
	window    time.Duration
	lastSweep time.Time
	now       func() time.Time
}

func New(limit int, window time.Duration) *Limiter {
	return &Limiter{entries: make(map[string]bucket), limit: limit, window: window, now: time.Now}
}
func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	if now.Sub(l.lastSweep) > l.window {
		for k, v := range l.entries {
			if now.Sub(v.start) > l.window {
				delete(l.entries, k)
			}
		}
		l.lastSweep = now
	}
	v := l.entries[key]
	if v.start.IsZero() || now.Sub(v.start) > l.window {
		v = bucket{start: now}
	}
	v.attempts++
	l.entries[key] = v
	return v.attempts <= l.limit
}
