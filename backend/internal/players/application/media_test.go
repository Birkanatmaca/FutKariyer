package application

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/png"
	"testing"

	"futcareer/backend/internal/platform/media"
	"futcareer/backend/internal/players/domain"
)

type fakeMedia struct {
	domain.MediaRepository
	added []media.File
}

func (f *fakeMedia) AddMedia(_ context.Context, ownerID, id string, file media.File) (domain.MediaItem, error) {
	f.added = append(f.added, file)
	return domain.MediaItem{ID: id, OwnerID: ownerID, Kind: file.Kind}, nil
}

func TestGalleryUploadValidatesBeforeStoring(t *testing.T) {
	repo := &fakeMedia{}
	service := NewMedia(repo)
	ctx := context.Background()
	if _, err := service.Upload(ctx, "owner", []byte("<script>")); !errors.Is(err, domain.ErrMediaInvalid) {
		t.Fatalf("garbage accepted: %v", err)
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, image.NewGray(image.Rect(0, 0, 4, 4))); err != nil {
		t.Fatal(err)
	}
	item, err := service.Upload(ctx, "owner", buf.Bytes())
	if err != nil || item.Kind != "image" || len(item.ID) != 32 || len(repo.added) != 1 {
		t.Fatalf("upload: %+v %v", item, err)
	}
}

func TestGalleryRejectsMalformedIDs(t *testing.T) {
	service := NewMedia(&fakeMedia{})
	ctx := context.Background()
	if _, err := service.List(ctx, "viewer", "../etc"); !errors.Is(err, domain.ErrMediaNotFound) {
		t.Fatalf("list: %v", err)
	}
	if err := service.Delete(ctx, "owner", "x"); !errors.Is(err, domain.ErrMediaNotFound) {
		t.Fatalf("delete: %v", err)
	}
	if _, _, err := service.File(ctx, "viewer", "0123456789abcdef0123456789abcdef", "bad"); !errors.Is(err, domain.ErrMediaNotFound) {
		t.Fatalf("file: %v", err)
	}
}
