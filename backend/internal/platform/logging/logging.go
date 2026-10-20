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
)

// Setup makes a JSON logger the process default. level: debug, info, warn
// or error (default info).
func Setup(service, env, version, level string) *slog.Logger {
	return setup(os.Stdout, service, env, version, level)
}

func setup(w io.Writer, service, env, version, level string) *slog.Logger {
	var lvl slog.Level
	switch strings.ToLower(level) {
	case "debug":
		lvl = slog.LevelDebug
	case "warn":
		lvl = slog.LevelWarn
	case "error":
		lvl = slog.LevelError
	default:
		lvl = slog.LevelInfo
	}
	json := slog.NewJSONHandler(w, &slog.HandlerOptions{
		Level: lvl,
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
// written with a *Context logging call.
type contextHandler struct{ slog.Handler }

func (h contextHandler) Handle(ctx context.Context, r slog.Record) error {
	if info := infoFrom(ctx); info != nil {
		r.AddAttrs(info.attrs()...)
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
