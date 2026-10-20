// Package metrics keeps the API's counters and latency histograms and serves
// them in the Prometheus text format (20 Oct 2026, docs/production/loglama.md
// §8). It is deliberately small and dependency-free. The endpoint listens on
// its own address (METRICS_ADDR) that is never published to the internet.
package metrics

import (
	"fmt"
	"io"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// maxSeries caps the label combinations of one metric, so scanners hitting
// random paths cannot grow memory without bound.
const maxSeries = 2000

type Registry struct {
	mu         sync.Mutex
	counters   map[string]*counter
	histograms map[string]*histogram
	gauges     []gauge
	started    time.Time
}

func New() *Registry {
	return &Registry{counters: map[string]*counter{}, histograms: map[string]*histogram{}, started: time.Now()}
}

type counter struct {
	help   string
	labels []string
	values map[string]float64
}

type histogram struct {
	help    string
	labels  []string
	buckets []float64
	series  map[string]*histSeries
}

type histSeries struct {
	counts []uint64
	sum    float64
	count  uint64
}

type gauge struct {
	name, help string
	read       func() []Sample
}

// Sample is one gauge value with its labels (name=value pairs).
type Sample struct {
	Labels []string
	Value  float64
}

func key(values []string) string { return strings.Join(values, "\x00") }

// Add increases a counter; label values follow the names given on first use.
func (r *Registry) Add(name, help string, labels []string, values []string, delta float64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	c := r.counters[name]
	if c == nil {
		c = &counter{help: help, labels: labels, values: map[string]float64{}}
		r.counters[name] = c
	}
	k := key(values)
	if _, ok := c.values[k]; !ok && len(c.values) >= maxSeries {
		return
	}
	c.values[k] += delta
}

// Observe records a duration or size in a histogram.
func (r *Registry) Observe(name, help string, buckets []float64, labels []string, values []string, v float64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	h := r.histograms[name]
	if h == nil {
		h = &histogram{help: help, labels: labels, buckets: buckets, series: map[string]*histSeries{}}
		r.histograms[name] = h
	}
	k := key(values)
	s := h.series[k]
	if s == nil {
		if len(h.series) >= maxSeries {
			return
		}
		s = &histSeries{counts: make([]uint64, len(h.buckets))}
		h.series[k] = s
	}
	for i, b := range h.buckets {
		if v <= b {
			s.counts[i]++
		}
	}
	s.sum += v
	s.count++
}

// Gauge registers a value read at scrape time.
func (r *Registry) Gauge(name, help string, read func() []Sample) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.gauges = append(r.gauges, gauge{name: name, help: help, read: read})
}

// LatencyBuckets suit HTTP requests and database statements (seconds).
var LatencyBuckets = []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}

func labelText(names, values []string) string {
	if len(names) == 0 {
		return ""
	}
	parts := make([]string, len(names))
	for i, n := range names {
		v := ""
		if i < len(values) {
			v = values[i]
		}
		parts[i] = n + `="` + strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", `\n`).Replace(v) + `"`
	}
	return "{" + strings.Join(parts, ",") + "}"
}

func number(v float64) string {
	if math.IsInf(v, 1) {
		return "+Inf"
	}
	return strconv.FormatFloat(v, 'g', -1, 64)
}

// Write prints every metric in the Prometheus text format.
func (r *Registry) Write(w io.Writer) {
	r.mu.Lock()
	gauges := append([]gauge(nil), r.gauges...)
	names := make([]string, 0, len(r.counters))
	for n := range r.counters {
		names = append(names, n)
	}
	sort.Strings(names)
	for _, n := range names {
		c := r.counters[n]
		fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s counter\n", n, c.help, n)
		keys := sortedKeys(c.values)
		for _, k := range keys {
			fmt.Fprintf(w, "%s%s %s\n", n, labelText(c.labels, strings.Split(k, "\x00")), number(c.values[k]))
		}
	}
	names = names[:0]
	for n := range r.histograms {
		names = append(names, n)
	}
	sort.Strings(names)
	for _, n := range names {
		h := r.histograms[n]
		fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s histogram\n", n, h.help, n)
		keys := make([]string, 0, len(h.series))
		for k := range h.series {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			s := h.series[k]
			values := strings.Split(k, "\x00")
			if k == "" {
				values = nil
			}
			for i, b := range h.buckets {
				fmt.Fprintf(w, "%s_bucket%s %d\n", n, labelText(append(append([]string{}, h.labels...), "le"), append(append([]string{}, values...), number(b))), s.counts[i])
			}
			fmt.Fprintf(w, "%s_bucket%s %d\n", n, labelText(append(append([]string{}, h.labels...), "le"), append(append([]string{}, values...), "+Inf")), s.count)
			fmt.Fprintf(w, "%s_sum%s %s\n%s_count%s %d\n", n, labelText(h.labels, values), number(s.sum), n, labelText(h.labels, values), s.count)
		}
	}
	r.mu.Unlock()
	for _, g := range gauges {
		fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s gauge\n", g.name, g.help, g.name)
		for _, s := range g.read() {
			names, values := []string{}, []string{}
			for i := 0; i+1 < len(s.Labels); i += 2 {
				names, values = append(names, s.Labels[i]), append(values, s.Labels[i+1])
			}
			fmt.Fprintf(w, "%s%s %s\n", g.name, labelText(names, values), number(s.Value))
		}
	}
}

func sortedKeys(m map[string]float64) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// Handler serves the metrics.
func (r *Registry) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		r.Write(w)
	})
}

// ObserveRequest is the logging middleware's hook: request count and
// latency per route. Unmatched paths (404) share one route label.
func (r *Registry) ObserveRequest(method, route string, status int, d time.Duration) {
	if status == 0 {
		status = http.StatusOK
	}
	if status == http.StatusNotFound || status == http.StatusMethodNotAllowed {
		route = "unmatched"
	}
	r.Add("http_requests_total", "HTTP requests by route and status.", []string{"method", "route", "status"}, []string{method, route, strconv.Itoa(status)}, 1)
	r.Observe("http_request_duration_seconds", "HTTP request latency by route.", LatencyBuckets, []string{"route"}, []string{route}, d.Seconds())
}
