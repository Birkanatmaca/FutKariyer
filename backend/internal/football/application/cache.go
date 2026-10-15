package application

import (
	"sync"
	"time"
)

// cache keeps upstream responses for a short time so the app never calls the
// provider or the TFF Ankara site once per viewer. Concurrent misses for the
// same key share one upstream call.
type cache struct {
	mu       sync.Mutex
	entries  map[string]entry
	inflight map[string]*call
	now      func() time.Time
}

type entry struct {
	value   any
	expires time.Time
}

type call struct {
	done  chan struct{}
	value any
	err   error
}

func newCache() *cache {
	return &cache{entries: map[string]entry{}, inflight: map[string]*call{}, now: time.Now}
}

func (c *cache) get(key string, ttl time.Duration, load func() (any, error)) (any, error) {
	c.mu.Lock()
	if e, ok := c.entries[key]; ok && c.now().Before(e.expires) {
		c.mu.Unlock()
		return e.value, nil
	}
	if in, ok := c.inflight[key]; ok {
		c.mu.Unlock()
		<-in.done
		return in.value, in.err
	}
	in := &call{done: make(chan struct{})}
	c.inflight[key] = in
	c.mu.Unlock()

	in.value, in.err = load()

	c.mu.Lock()
	delete(c.inflight, key)
	if in.err == nil {
		c.entries[key] = entry{value: in.value, expires: c.now().Add(ttl)}
		if len(c.entries) > 2000 {
			c.evictExpired()
		}
	}
	c.mu.Unlock()
	close(in.done)
	return in.value, in.err
}

func (c *cache) evictExpired() {
	now := c.now()
	for k, e := range c.entries {
		if !now.Before(e.expires) {
			delete(c.entries, k)
		}
	}
}
