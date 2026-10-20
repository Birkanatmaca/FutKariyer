package metrics

import (
	"bytes"
	"strings"
	"testing"
	"time"
)

func TestTextFormat(t *testing.T) {
	r := New()
	r.ObserveRequest("GET", "/v1/leagues", 200, 30*time.Millisecond)
	r.ObserveRequest("GET", "/v1/leagues", 200, 2*time.Second)
	r.ObserveRequest("GET", "/wp-login.php", 404, time.Millisecond)
	r.Gauge("db_pool_in_use", "Connections in use.", func() []Sample { return []Sample{{Value: 3}} })
	var buf bytes.Buffer
	r.Write(&buf)
	out := buf.String()
	for _, want := range []string{
		`http_requests_total{method="GET",route="/v1/leagues",status="200"} 2`,
		`http_requests_total{method="GET",route="unmatched",status="404"} 1`,
		`http_request_duration_seconds_bucket{route="/v1/leagues",le="0.05"} 1`,
		`http_request_duration_seconds_bucket{route="/v1/leagues",le="+Inf"} 2`,
		`http_request_duration_seconds_count{route="/v1/leagues"} 2`,
		"# TYPE http_request_duration_seconds histogram",
		"db_pool_in_use 3",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in:\n%s", want, out)
		}
	}
}

func TestSeriesAreCapped(t *testing.T) {
	r := New()
	for i := 0; i < maxSeries+50; i++ {
		r.Add("x_total", "x", []string{"k"}, []string{string(rune('a'+i%26)) + strings.Repeat("z", i)}, 1)
	}
	if n := len(r.counters["x_total"].values); n != maxSeries {
		t.Fatalf("series %d", n)
	}
}
