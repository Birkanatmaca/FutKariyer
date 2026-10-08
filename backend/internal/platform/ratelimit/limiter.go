package ratelimit

import (
	"sync"
	"time"
)

type bucket struct {
	start    time.Time
	attempts int
}
type Limiter struct {
	mu      sync.Mutex
	entries map[string]bucket
	limit   int
	window  time.Duration
}

func New(limit int, window time.Duration) *Limiter {
	return &Limiter{entries: make(map[string]bucket), limit: limit, window: window}
}
func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	for k, v := range l.entries {
		if now.Sub(v.start) > l.window {
			delete(l.entries, k)
		}
	}
	v := l.entries[key]
	if v.start.IsZero() {
		v.start = now
	}
	v.attempts++
	l.entries[key] = v
	return v.attempts <= l.limit
}
