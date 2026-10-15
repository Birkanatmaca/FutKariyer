package application

import (
	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/platform/media"
	"futcareer/backend/internal/social/domain"
)

const MaxImageBytes = media.MaxImageBytes
const MaxVideoBytes = media.MaxVideoBytes

func validateMedia(data []byte) (*domain.Attachment, error) {
	file, err := media.Validate(data)
	if err != nil {
		return nil, auth.ValidationError{"media": "JPEG/PNG görsel (4 MiB) veya MP4 video (30 MiB) seç."}
	}
	return &domain.Attachment{Media: domain.Media{Kind: file.Kind, MIME: file.MIME, Size: file.Size, Width: file.Width, Height: file.Height}, Data: file.Data}, nil
}
