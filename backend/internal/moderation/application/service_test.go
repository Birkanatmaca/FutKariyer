package application

import (
	"context"
	"errors"
	"testing"

	"futcareer/backend/internal/moderation/domain"
)

type fakeRepo struct {
	domain.Repository
	reported []domain.ReportInput
	blocked  [][2]string
}

func (f *fakeRepo) Target(_ context.Context, reporterID, _, _ string) (domain.Target, error) {
	if reporterID == "author" {
		return domain.Target{}, domain.ErrForbidden
	}
	return domain.Target{UserID: "author", Excerpt: "text"}, nil
}
func (f *fakeRepo) CreateReport(_ context.Context, _, _ string, in domain.ReportInput, _ domain.Target) error {
	f.reported = append(f.reported, in)
	return nil
}
func (f *fakeRepo) Block(_ context.Context, a, b string) error {
	f.blocked = append(f.blocked, [2]string{a, b})
	return nil
}

const target = "0123456789abcdef0123456789abcdef"

func TestReportValidation(t *testing.T) {
	repo := &fakeRepo{}
	service := New(repo)
	ctx := context.Background()
	for _, in := range []domain.ReportInput{
		{TargetKind: "comment", TargetID: target, Reason: "spam"},
		{TargetKind: "post", TargetID: "../x", Reason: "spam"},
		{TargetKind: "post", TargetID: target, Reason: "boring"},
		{TargetKind: "post", TargetID: target, Reason: "other", Note: string(make([]rune, 501))},
	} {
		if err := service.Report(ctx, "viewer", in); !errors.Is(err, domain.ErrInvalid) {
			t.Fatalf("%+v accepted: %v", in, err)
		}
	}
	if err := service.Report(ctx, "author", domain.ReportInput{TargetKind: "post", TargetID: target, Reason: "spam"}); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("own content reported: %v", err)
	}
	if err := service.Report(ctx, "viewer", domain.ReportInput{TargetKind: "reply", TargetID: target, Reason: "harassment", Note: "  rude  "}); err != nil {
		t.Fatal(err)
	}
	if got := repo.reported[0]; got.Note != "rude" {
		t.Fatalf("note was not trimmed: %q", got.Note)
	}
}

func TestBlockAndResolveInput(t *testing.T) {
	repo := &fakeRepo{}
	service := New(repo)
	ctx := context.Background()
	if err := service.Block(ctx, target, target); !errors.Is(err, domain.ErrInvalid) {
		t.Fatalf("self block: %v", err)
	}
	if err := service.Block(ctx, "viewer", "not-an-id"); !errors.Is(err, domain.ErrInvalid) {
		t.Fatalf("bad id: %v", err)
	}
	if err := service.Block(ctx, "viewer", target); err != nil || len(repo.blocked) != 1 {
		t.Fatalf("block: %v", err)
	}
	if _, err := service.Resolve(ctx, target, "ban-forever"); !errors.Is(err, domain.ErrInvalid) {
		t.Fatalf("unknown action: %v", err)
	}
	if _, err := service.Reports(ctx, "everything", 1, 20); !errors.Is(err, domain.ErrInvalid) {
		t.Fatalf("unknown status: %v", err)
	}
}
