// Package logging is the one way the backend writes logs (20 Oct 2026, see
// docs/production/loglama.md): single-line JSON to stdout, an event name as
// the message, and the request's id, route and account added automatically
// from the context. Personal data (emails, passwords, tokens, codes, bodies)
// is never logged.
package logging

import (
	"context"
	"io"
	"log/slog"
	"net"
	"os"
	"strings"
	"sync/atomic"
	"time"
)

// Setup makes a JSON logger the process default. level: debug, info, warn
// or error (default info).
func Setup(service, env, version, level string) *slog.Logger {
	return setup(os.Stdout, service, env, version, level)
}

// level is the minimum level written; the admin panel changes it at run
// time (SetLevel).
var level = new(slog.LevelVar)

func parseLevel(name string) (slog.Level, bool) {
	switch strings.ToLower(name) {
	case "debug":
		return slog.LevelDebug, true
	case "info":
		return slog.LevelInfo, true
	case "warn":
		return slog.LevelWarn, true
	case "error":
		return slog.LevelError, true
	}
	return slog.LevelInfo, false
}

// SetLevel changes the minimum level (debug, info, warn, error) at once.
func SetLevel(name string) bool {
	lvl, ok := parseLevel(name)
	if ok {
		level.Set(lvl)
	}
	return ok
}

// Level is the current minimum level's name.
func Level() string { return strings.ToLower(level.Level().String()) }

func setup(w io.Writer, service, env, version, levelName string) *slog.Logger {
	lvl, _ := parseLevel(levelName)
	level.Set(lvl)
	buildVersion = version
	json := slog.NewJSONHandler(w, &slog.HandlerOptions{
		Level: level,
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			if len(groups) == 0 && a.Key == slog.MessageKey {
				a.Key = "event"
			}
			return a
		},
	})
	logger := slog.New(contextHandler{json}).With("service", service, "env", env, "version", version)
	slog.SetDefault(logger)
	return logger
}

// contextHandler adds the request fields of the context to every record
// written with a *Context logging call, and hands records to the sink.
type contextHandler struct{ slog.Handler }

func (h contextHandler) Handle(ctx context.Context, r slog.Record) error {
	if info := infoFrom(ctx); info != nil {
		r.AddAttrs(info.attrs()...)
	}
	if s := currentSink.Load(); s != nil {
		(*s).Accept(toEntry(r))
	}
	return h.Handler.Handle(ctx, r)
}
func (h contextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return contextHandler{h.Handler.WithAttrs(attrs)}
}
func (h contextHandler) WithGroup(name string) slog.Handler {
	return contextHandler{h.Handler.WithGroup(name)}
}

// Secret is logged as "[gizli]" whatever it holds, so a value that slips
// into a log call does not leak.
type Secret string

func (Secret) LogValue() slog.Value { return slog.StringValue("[gizli]") }

// MaskIP keeps the network part of an address: the last IPv4 octet and the
// last 80 bits of IPv6 are zeroed (no longer personal data under KVKK).
func MaskIP(ip string) string {
	parsed := net.ParseIP(strings.TrimSpace(ip))
	if parsed == nil {
		return ""
	}
	if v4 := parsed.To4(); v4 != nil {
		return v4.Mask(net.CIDRMask(24, 32)).String()
	}
	return parsed.Mask(net.CIDRMask(48, 128)).String()
}

// SetupTo is Setup writing to w (tests that read the log).
func SetupTo(w io.Writer, service, env, version, level string) *slog.Logger {
	return setup(w, service, env, version, level)
}

var buildVersion string

// Entry is a log line as a sink receives it: the standard fields plus every
// attribute by key.
type Entry struct {
	Time    time.Time
	Level   string
	Event   string
	Version string
	Attrs   map[string]any
}

// Sink receives every written line, e.g. to keep some of them in the
// database for the admin panel. Accept must not block or log.
type Sink interface{ Accept(Entry) }

var currentSink atomic.Pointer[Sink]

// SetSink installs (or with nil removes) the sink.
func SetSink(s Sink) {
	if s == nil {
		currentSink.Store(nil)
		return
	}
	currentSink.Store(&s)
}

func toEntry(r slog.Record) Entry {
	e := Entry{Time: r.Time, Level: r.Level.String(), Event: r.Message, Version: buildVersion, Attrs: make(map[string]any, r.NumAttrs())}
	r.Attrs(func(a slog.Attr) bool {
		v := a.Value.Resolve()
		if v.Kind() == slog.KindGroup {
			for _, g := range v.Group() {
				e.Attrs[a.Key+"."+g.Key] = g.Value.Resolve().Any()
			}
			return true
		}
		e.Attrs[a.Key] = v.Any()
		return true
	})
	return e
}
