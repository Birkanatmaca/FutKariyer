package application

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/mail"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"futcareer/backend/internal/auth/domain"
	"golang.org/x/crypto/bcrypt"
)

type ValidationError map[string]string

func (e ValidationError) Error() string { return "Bilgilerini kontrol edip tekrar dene." }

type RegisterInput struct {
	FullName      string `json:"fullName"`
	Email         string `json:"email"`
	Password      string `json:"password"`
	Role          string `json:"role"`
	FootballType  string `json:"footballType"`
	LicenseStatus string `json:"licenseStatus"`
}
type LoginInput struct {
	Identifier string `json:"identifier"`
	Email      string `json:"email"`
	Password   string `json:"password"`
}
type PublicUser struct {
	ID        string    `json:"id"`
	FullName  string    `json:"fullName"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	Active    bool      `json:"active"`
	Verified  bool      `json:"verified"`
	Role      string    `json:"role"`
	City      string    `json:"city"`
	CreatedAt time.Time `json:"createdAt"`
}
type AuthResult struct {
	Token     string     `json:"token"`
	ExpiresAt time.Time  `json:"expiresAt"`
	User      PublicUser `json:"user"`
}
type Service struct {
	repo      domain.Repository
	ttl       time.Duration
	dummyHash []byte
	now       func() time.Time
}

func New(repo domain.Repository, ttl time.Duration) *Service {
	dummy, _ := bcrypt.GenerateFromPassword([]byte("unusable-placeholder-password"), bcrypt.DefaultCost)
	return &Service{repo: repo, ttl: ttl, dummyHash: dummy, now: time.Now}
}
func Public(u domain.User) PublicUser {
	return PublicUser{ID: u.ID, FullName: u.FullName, Email: u.Email, Username: u.Username, Active: u.Active, Verified: u.Verified, Role: u.Role, City: u.City, CreatedAt: u.CreatedAt}
}
func canonicalEmail(email string) string { return strings.ToLower(strings.TrimSpace(email)) }
func validEmail(email string) bool {
	parsed, err := mail.ParseAddress(email)
	return err == nil && parsed.Address == email && len(email) <= 254 && strings.Contains(strings.SplitN(email, "@", 2)[1], ".")
}
func (s *Service) Register(ctx context.Context, in RegisterInput) (AuthResult, error) {
	in.FullName = strings.TrimSpace(in.FullName)
	in.Email = canonicalEmail(in.Email)
	fields := ValidationError{}
	if n := utf8.RuneCountInString(in.FullName); n < 2 || n > 80 {
		fields["fullName"] = "Adın 2–80 karakter arasında olmalı."
	}
	if !validEmail(in.Email) {
		fields["email"] = "Geçerli bir e-posta adresi gir."
	}
	if utf8.RuneCountInString(in.Password) < 10 || len(in.Password) > 72 {
		fields["password"] = "Şifren en az 10 karakter olmalı ve 72 bayttan uzun olmamalı."
	}
	if in.Role != "player" {
		fields["role"] = "Kendi kaydını yalnızca sporcu olarak oluşturabilirsin."
	}
	if in.FootballType != "amateur" && in.FootballType != "professional" && in.FootballType != "halisaha" {
		fields["footballType"] = "Futbol türünü seç."
	}
	if in.LicenseStatus != "licensed" && in.LicenseStatus != "unlicensed" {
		fields["licenseStatus"] = "Lisans durumunu seç."
	}
	if len(fields) > 0 {
		return AuthResult{}, fields
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return AuthResult{}, err
	}
	idBytes := make([]byte, 16)
	if _, err = rand.Read(idBytes); err != nil {
		return AuthResult{}, err
	}
	user := domain.User{ID: hex.EncodeToString(idBytes), FullName: in.FullName, Email: in.Email, PasswordHash: string(hash), Role: in.Role, City: "Ankara", FootballType: in.FootballType, LicenseStatus: in.LicenseStatus, Active: true, CreatedAt: s.now().UTC()}
	token, session, err := s.newSession(user.ID)
	if err != nil {
		return AuthResult{}, err
	}
	if err = s.repo.Register(ctx, user, session); err != nil {
		return AuthResult{}, err
	}
	return AuthResult{Token: token, ExpiresAt: session.ExpiresAt, User: Public(user)}, nil
}
func (s *Service) Login(ctx context.Context, in LoginInput) (AuthResult, error) {
	return s.login(ctx, in, "mobile")
}
func (s *Service) AdminLogin(ctx context.Context, in LoginInput) (AuthResult, error) {
	return s.login(ctx, in, "admin")
}
func (s *Service) login(ctx context.Context, in LoginInput, audience string) (AuthResult, error) {
	identifier := in.Identifier
	if identifier == "" {
		identifier = in.Email
	}
	user, err := s.repo.UserByLogin(ctx, canonicalEmail(identifier))
	if errors.Is(err, domain.ErrNotFound) {
		_ = bcrypt.CompareHashAndPassword(s.dummyHash, []byte(in.Password))
		return AuthResult{}, domain.ErrUnauthorized
	}
	if err != nil {
		return AuthResult{}, err
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(in.Password)) != nil {
		return AuthResult{}, domain.ErrUnauthorized
	}
	// The application state is only revealed after the password matched.
	if !user.Active {
		switch user.ApprovalStatus {
		case "pending":
			return AuthResult{}, domain.ErrPendingApproval
		case "rejected":
			return AuthResult{}, domain.ErrApplicationRejected
		}
		return AuthResult{}, domain.ErrUnauthorized
	}
	if (user.Role == "admin") != (audience == "admin") {
		return AuthResult{}, domain.ErrWrongPortal
	}
	token, session, err := s.newSession(user.ID)
	if err != nil {
		return AuthResult{}, err
	}
	session.AuthVersion = user.AuthVersion
	session.Audience = audience
	if audience == "admin" && session.ExpiresAt.After(s.now().Add(8*time.Hour)) {
		session.ExpiresAt = s.now().UTC().Add(8 * time.Hour)
	}
	if err = s.repo.CreateSession(ctx, session); err != nil {
		return AuthResult{}, err
	}
	return AuthResult{Token: token, ExpiresAt: session.ExpiresAt, User: Public(user)}, nil
}
func (s *Service) Me(ctx context.Context, token string) (PublicUser, error) {
	return s.me(ctx, token, "mobile")
}
func (s *Service) AdminMe(ctx context.Context, token string) (PublicUser, error) {
	return s.me(ctx, token, "admin")
}
func (s *Service) me(ctx context.Context, token, audience string) (PublicUser, error) {
	if len(token) != 43 {
		return PublicUser{}, domain.ErrUnauthorized
	}
	session, err := s.repo.SessionByHash(ctx, HashToken(token))
	if errors.Is(err, domain.ErrNotFound) {
		return PublicUser{}, domain.ErrUnauthorized
	}
	if err != nil {
		return PublicUser{}, err
	}
	if !session.ExpiresAt.After(s.now()) || session.Audience != audience {
		return PublicUser{}, domain.ErrUnauthorized
	}
	user, err := s.repo.UserByID(ctx, session.UserID)
	if errors.Is(err, domain.ErrNotFound) {
		return PublicUser{}, domain.ErrUnauthorized
	}
	if err != nil {
		return PublicUser{}, err
	}
	if !user.Active || session.AuthVersion != user.AuthVersion || (user.Role == "admin") != (audience == "admin") {
		return PublicUser{}, domain.ErrUnauthorized
	}
	return Public(user), nil
}

// DeleteAccount permanently removes the signed-in mobile account after the
// password is confirmed. Profile, posts, follows, requests and sessions go
// with it; payment records keep the amount but lose the account link.
func (s *Service) DeleteAccount(ctx context.Context, token, password string) error {
	public, err := s.Me(ctx, token)
	if err != nil {
		return err
	}
	user, err := s.repo.UserByID(ctx, public.ID)
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		return ValidationError{"password": "Şifre doğru değil."}
	}
	return s.repo.DeleteUser(ctx, user.ID)
}

func (s *Service) Logout(ctx context.Context, token string) error {
	return s.repo.DeleteSession(ctx, HashToken(token))
}
func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
func (s *Service) newSession(userID string) (string, domain.Session, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", domain.Session{}, err
	}
	token := base64.RawURLEncoding.EncodeToString(bytes)
	return token, domain.Session{Audience: "mobile", TokenHash: HashToken(token), UserID: userID, ExpiresAt: s.now().UTC().Add(s.ttl)}, nil
}

type ApplyInput struct {
	Role         string `json:"role"`
	FullName     string `json:"fullName"`
	ContactName  string `json:"contactName"`
	Username     string `json:"username"`
	Email        string `json:"email"`
	Password     string `json:"password"`
	Phone        string `json:"phone"`
	District     string `json:"district"`
	FootballType string `json:"footballType"`
	Note         string `json:"note"`
}

var phonePattern = regexp.MustCompile(`^[0-9 +()-]{0,30}$`)

// Apply records a club or organizer sign-up. The account cannot sign in until an
// administrator approves it, so no session is created here.
func (s *Service) Apply(ctx context.Context, in ApplyInput) error {
	repo, ok := s.repo.(domain.ApplicationRepository)
	if !ok {
		return errors.New("account applications are not supported by this repository")
	}
	in.FullName = strings.TrimSpace(in.FullName)
	in.ContactName = strings.TrimSpace(in.ContactName)
	in.Username = strings.ToLower(strings.TrimSpace(in.Username))
	in.Email = canonicalEmail(in.Email)
	in.Phone = strings.TrimSpace(in.Phone)
	in.District = strings.TrimSpace(in.District)
	in.Note = strings.TrimSpace(in.Note)
	fields := ValidationError{}
	if in.Role != "club" && in.Role != "organizer" {
		fields["role"] = "Başvuru türü kulüp veya organizasyon olmalı."
	}
	if n := utf8.RuneCountInString(in.FullName); n < 2 || n > 80 {
		fields["fullName"] = "Ad 2–80 karakter arasında olmalı."
	}
	if n := utf8.RuneCountInString(in.ContactName); n < 2 || n > 80 {
		fields["contactName"] = "Yetkili kişinin adı 2–80 karakter olmalı."
	}
	if !usernamePattern.MatchString(in.Username) {
		fields["username"] = "3–32 karakter; küçük Latin harfi, rakam, nokta, alt çizgi veya kısa çizgi kullan."
	}
	if !validEmail(in.Email) {
		fields["email"] = "Geçerli bir e-posta adresi gir."
	}
	if utf8.RuneCountInString(in.Password) < 10 || len(in.Password) > 72 {
		fields["password"] = "Şifre en az 10 karakter olmalı ve 72 bayttan uzun olmamalı."
	}
	if !phonePattern.MatchString(in.Phone) {
		fields["phone"] = "Telefon en fazla 30 karakter olmalı ve yalnızca rakam, boşluk, +, -, ( ) içermeli."
	}
	if utf8.RuneCountInString(in.District) > 80 {
		fields["district"] = "İlçe en fazla 80 karakter olabilir."
	}
	if utf8.RuneCountInString(in.Note) > 500 {
		fields["note"] = "Not en fazla 500 karakter olabilir."
	}
	if in.Role == "club" && in.FootballType != "amateur" && in.FootballType != "professional" && in.FootballType != "halisaha" {
		fields["footballType"] = "Takım türünü seç."
	}
	if in.Role != "club" {
		in.FootballType = ""
	}
	if len(fields) > 0 {
		return fields
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	idBytes := make([]byte, 16)
	if _, err = rand.Read(idBytes); err != nil {
		return err
	}
	user := domain.User{ID: hex.EncodeToString(idBytes), FullName: in.FullName, Email: in.Email, Username: in.Username, PasswordHash: string(hash), Role: in.Role, City: "Ankara", CreatedAt: s.now().UTC()}
	return repo.Apply(ctx, user, domain.Application{ContactName: in.ContactName, Phone: in.Phone, District: in.District, Note: in.Note, FootballType: in.FootballType})
}
