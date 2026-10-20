package application

import (
	"context"
	"log/slog"
	"slices"
	"strings"
	"time"

	"futcareer/backend/internal/platform/logging"
	"futcareer/backend/internal/systemlogs/domain"
)

// ValidationError lists fields the panel must correct.
type ValidationError map[string]string

func (e ValidationError) Error() string { return "Bilgileri kontrol edip tekrar dene." }

// Live reads the running API's counters (metrics registry).
type Live interface {
	Requests() (total, serverErrors float64)
}

type Service struct {
	repo    domain.Repository
	writer  *Writer
	live    Live
	started time.Time
}

func New(repo domain.Repository, writer *Writer, live Live) *Service {
	return &Service{repo: repo, writer: writer, live: live, started: time.Now()}
}

// Windows the panel offers, in hours.
var windows = []int{1, 6, 24, 168, 720}

func since(hours int) time.Time {
	if !slices.Contains(windows, hours) {
		hours = 24
	}
	return time.Now().Add(-time.Duration(hours) * time.Hour)
}

func (s *Service) List(ctx context.Context, kind, search, userID string, hours, page int) (domain.Page, error) {
	if !slices.Contains(domain.Kinds, kind) {
		kind = domain.KindAll
	}
	if page < 1 || page > 200 {
		page = 1
	}
	search = strings.TrimSpace(search)
	if len(search) > 120 {
		search = search[:120]
	}
	userID = strings.TrimSpace(userID)
	if len(userID) > 64 {
		userID = ""
	}
	return s.repo.List(ctx, domain.Query{Kind: kind, Search: search, UserID: userID, Since: since(hours), Page: page})
}

func (s *Service) Get(ctx context.Context, id int64) (domain.Entry, error) {
	return s.repo.Get(ctx, id)
}

func (s *Service) Summary(ctx context.Context, hours int) (domain.Summary, error) {
	out, err := s.repo.Summary(ctx, since(hours))
	if err != nil {
		return out, err
	}
	out.Live = domain.Live{UptimeSeconds: time.Since(s.started).Seconds(), Level: logging.Level(), Version: buildVersion()}
	if s.live != nil {
		out.Live.Requests, out.Live.ServerErrors = s.live.Requests()
	}
	if s.writer != nil {
		out.Live.Dropped = s.writer.Dropped()
	}
	return out, nil
}

func buildVersion() string {
	v, _ := versionValue.Load().(string)
	return v
}

func (s *Service) Settings(ctx context.Context) (domain.Settings, error) {
	return s.repo.Settings(ctx)
}

// SaveSettings validates, stores and applies at once (level, request storage).
func (s *Service) SaveSettings(ctx context.Context, in domain.Settings, adminID string) (domain.Settings, error) {
	fields := ValidationError{}
	in.Level = strings.ToLower(strings.TrimSpace(in.Level))
	if !slices.Contains([]string{"debug", "info", "warn", "error"}, in.Level) {
		fields["level"] = "Seviye debug, info, warn veya error olmalı."
	}
	if in.RequestDays < 1 || in.RequestDays > 90 {
		fields["requestDays"] = "İstek logları 1–90 gün saklanabilir."
	}
	if in.ProblemDays < 7 || in.ProblemDays > 365 {
		fields["problemDays"] = "Hata ve uyarılar 7–365 gün saklanabilir."
	}
	if in.SecurityDays < 30 || in.SecurityDays > 730 {
		fields["securityDays"] = "Güvenlik olayları 30–730 gün saklanabilir."
	}
	if len(fields) > 0 {
		return domain.Settings{}, fields
	}
	saved, err := s.repo.SaveSettings(ctx, in, adminID)
	if err != nil {
		return saved, err
	}
	s.apply(saved)
	slog.InfoContext(ctx, "logs.settings.changed", "level", saved.Level, "store_requests", saved.StoreRequests)
	return saved, nil
}

func (s *Service) apply(settings domain.Settings) {
	logging.SetLevel(settings.Level)
	if s.writer != nil {
		s.writer.storeRequests.Store(settings.StoreRequests)
	}
}

// Run applies the stored settings at start and then hourly removes lines
// past their retention.
func (s *Service) Run(ctx context.Context) {
	settings, err := s.repo.Settings(ctx)
	if err == nil {
		s.apply(settings)
	} else {
		slog.ErrorContext(ctx, "logs.settings.load_failed", "error", err)
	}
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		if settings, err := s.repo.Settings(ctx); err == nil {
			if removed, err := s.repo.Cleanup(ctx, settings, time.Now()); err != nil && ctx.Err() == nil {
				slog.ErrorContext(ctx, "logs.cleanup.failed", "error", err)
			} else if removed > 0 {
				slog.InfoContext(ctx, "logs.cleanup", "removed", removed)
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
