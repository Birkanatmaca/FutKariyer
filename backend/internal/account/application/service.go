package application

import (
	"context"
	"regexp"
	"strings"
	"time"

	"futcareer/backend/internal/account/domain"
	auth "futcareer/backend/internal/auth/application"
	platformmedia "futcareer/backend/internal/platform/media"
)

type Service struct {
	repo domain.Repository
	now  func() time.Time
}

func New(repo domain.Repository) *Service { return &Service{repo: repo, now: time.Now} }

var (
	validID       = regexp.MustCompile(`^[a-f0-9]{32}$`)
	usernameShape = regexp.MustCompile(`^[a-z0-9._-]{3,32}$`)
)

type Input struct {
	FullName  string `json:"fullName"`
	Username  string `json:"username"`
	City      string `json:"city"`
	District  string `json:"district"`
	BirthDate string `json:"birthDate"`
	Bio       string `json:"bio"`
	HeightCm  *int   `json:"heightCm"`
	WeightKg  *int   `json:"weightKg"`
}

func (s *Service) Get(ctx context.Context, userID string) (domain.Profile, error) {
	return s.repo.Profile(ctx, userID)
}

// Save validates every field; a club or organizer must keep a username because
// it is their sign-in name.
func (s *Service) Save(ctx context.Context, userID string, in Input) (domain.Profile, error) {
	current, err := s.repo.Profile(ctx, userID)
	if err != nil {
		return current, err
	}
	fields := auth.ValidationError{}
	p := current
	p.FullName = strings.Join(strings.Fields(in.FullName), " ")
	p.Username = strings.ToLower(strings.TrimSpace(in.Username))
	p.City = strings.TrimSpace(in.City)
	p.District = strings.TrimSpace(in.District)
	p.Bio = strings.TrimSpace(strings.ReplaceAll(in.Bio, "\r\n", "\n"))
	if n := len([]rune(p.FullName)); n < 2 || n > 80 {
		fields["fullName"] = "Adın 2–80 karakter arasında olmalı."
	}
	if p.Username == "" {
		if current.Username != "" && (current.Role == "club" || current.Role == "organizer") {
			fields["username"] = "Kullanıcı adı boş bırakılamaz."
		}
	} else if !usernameShape.MatchString(p.Username) {
		fields["username"] = "Kullanıcı adı 3–32 karakter; küçük harf, rakam, nokta, alt çizgi veya tire olmalı."
	}
	if n := len([]rune(p.City)); n < 2 || n > 40 {
		fields["city"] = "Şehir 2–40 karakter olmalı."
	}
	if len([]rune(p.District)) > 60 {
		fields["district"] = "İlçe en fazla 60 karakter olabilir."
	}
	if len([]rune(p.Bio)) > 300 {
		fields["bio"] = "Hakkında en fazla 300 karakter olabilir."
	}
	p.BirthDate = nil
	if value := strings.TrimSpace(in.BirthDate); value != "" {
		date, err := time.Parse("2006-01-02", value)
		limit := s.now().AddDate(-6, 0, 0)
		if err != nil || date.Year() < 1930 || date.After(limit) {
			fields["birthDate"] = "Geçerli bir doğum tarihi gir."
		} else {
			p.BirthDate = &date
		}
	}
	p.HeightCm, p.WeightKg = in.HeightCm, in.WeightKg
	if p.HeightCm != nil && (*p.HeightCm < 120 || *p.HeightCm > 230) {
		fields["heightCm"] = "Boy 120–230 cm arasında olmalı."
	}
	if p.WeightKg != nil && (*p.WeightKg < 35 || *p.WeightKg > 160) {
		fields["weightKg"] = "Kilo 35–160 kg arasında olmalı."
	}
	if len(fields) > 0 {
		return current, fields
	}
	out, err := s.repo.SaveProfile(ctx, p)
	if err == domain.ErrUsernameTaken {
		return current, auth.ValidationError{"username": "Bu kullanıcı adı alınmış."}
	}
	return out, err
}

// SetAvatar accepts a JPEG or PNG; it is re-encoded so no metadata (location)
// leaves the device's original file.
func (s *Service) SetAvatar(ctx context.Context, userID string, data []byte) (domain.Profile, error) {
	file, err := platformmedia.Validate(data)
	if err != nil || file.Kind != "image" {
		return domain.Profile{}, auth.ValidationError{"avatar": "En fazla 4 MiB olan bir JPEG veya PNG fotoğraf seç."}
	}
	return s.repo.SetAvatar(ctx, userID, file.MIME, file.Data)
}

func (s *Service) DeleteAvatar(ctx context.Context, userID string) (domain.Profile, error) {
	return s.repo.DeleteAvatar(ctx, userID)
}

func (s *Service) Avatar(ctx context.Context, userID string) (domain.Avatar, error) {
	if !validID.MatchString(userID) {
		return domain.Avatar{}, domain.ErrNotFound
	}
	return s.repo.Avatar(ctx, userID)
}
