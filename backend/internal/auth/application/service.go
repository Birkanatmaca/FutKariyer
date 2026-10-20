package application

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/mail"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"futcareer/backend/internal/auth/domain"
	coachdomain "futcareer/backend/internal/coaches/domain"
	"futcareer/backend/internal/platform/audit"
	"futcareer/backend/internal/platform/logging"
	platformmail "futcareer/backend/internal/platform/mail"
	"futcareer/backend/internal/platform/secretbox"

	"golang.org/x/crypto/bcrypt"
)

type ValidationError map[string]string

func (e ValidationError) Error() string { return "Bilgilerini kontrol edip tekrar dene." }

// RegisterInput is a self sign-up. Players declare whether they hold a licence
// (LicenseStatus), coaches their licence level (LicenseLevel).
type RegisterInput struct {
	FullName      string `json:"fullName"`
	Email         string `json:"email"`
	Password      string `json:"password"`
	Role          string `json:"role"`
	FootballType  string `json:"footballType"`
	LicenseStatus string `json:"licenseStatus"`
	LicenseLevel  string `json:"licenseLevel"`
	// Device is a short label of the phone, shown under Active sessions.
	Device string `json:"device"`
}
type LoginInput struct {
	Identifier string `json:"identifier"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	Device     string `json:"device"`
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
	// EmailVerified is false only for a self sign-up that still has to enter
	// its code while email sending is configured.
	EmailVerified bool `json:"emailVerified"`
	// Delegate is set while a coach runs this club account after switching.
	Delegate *Delegate `json:"delegate,omitempty"`
}

// Delegate describes the coach behind a switched club session and the club
// sections the club opened to them.
type Delegate struct {
	CoachID     string   `json:"coachId"`
	CoachName   string   `json:"coachName"`
	Permissions []string `json:"permissions"`
}

// Can reports whether the session may use a club section; the account owner
// always can, a switched coach only where the club allowed it.
func (u PublicUser) Can(permission string) bool {
	return u.Delegate == nil || slices.Contains(u.Delegate.Permissions, permission)
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
	// mailer is nil while email sending is not configured.
	mailer platformmail.Sender
	// totpBox seals admin authenticator keys; nil turns admin 2FA off.
	totpBox *secretbox.Box
}

func New(repo domain.Repository, ttl time.Duration) *Service {
	dummy, _ := bcrypt.GenerateFromPassword([]byte("unusable-placeholder-password"), PasswordCost)
	return &Service{repo: repo, ttl: ttl, dummyHash: dummy, now: time.Now}
}

// WithMailer turns on email verification and password reset.
func (s *Service) WithMailer(m platformmail.Sender) *Service {
	s.mailer = m
	return s
}

func (s *Service) public(u domain.User) PublicUser {
	p := Public(u)
	p.EmailVerified = u.EmailVerified || s.mailer == nil
	return p
}
func Public(u domain.User) PublicUser {
	return PublicUser{ID: u.ID, FullName: u.FullName, Email: u.Email, Username: u.Username, Active: u.Active, Verified: u.Verified, Role: u.Role, City: u.City, CreatedAt: u.CreatedAt, EmailVerified: u.EmailVerified}
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
	// Players and coaches open their own accounts; clubs and organizers apply.
	switch in.Role {
	case "player":
		if in.LicenseStatus != "licensed" && in.LicenseStatus != "unlicensed" {
			fields["licenseStatus"] = "Lisans durumunu seç."
		}
		in.LicenseLevel = ""
	case "coach":
		if in.LicenseLevel == "unknown" || !slices.Contains(coachdomain.LicenseLevels, in.LicenseLevel) {
			fields["licenseLevel"] = "Antrenör lisansını seç."
		}
		in.LicenseStatus = ""
	default:
		fields["role"] = "Kendi kaydını sporcu veya antrenör olarak oluşturabilirsin."
	}
	if in.FootballType != "amateur" && in.FootballType != "professional" && in.FootballType != "halisaha" {
		fields["footballType"] = "Futbol türünü seç."
	}
	if len(fields) > 0 {
		return AuthResult{}, fields
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), PasswordCost)
	if err != nil {
		return AuthResult{}, err
	}
	idBytes := make([]byte, 16)
	if _, err = rand.Read(idBytes); err != nil {
		return AuthResult{}, err
	}
	user := domain.User{ID: hex.EncodeToString(idBytes), FullName: in.FullName, Email: in.Email, PasswordHash: string(hash), Role: in.Role, City: "Ankara", FootballType: in.FootballType, LicenseStatus: in.LicenseStatus, LicenseLevel: in.LicenseLevel, Active: true, CreatedAt: s.now().UTC()}
	token, session, err := s.newSession(user.ID)
	if err != nil {
		return AuthResult{}, err
	}
	session.Device = deviceLabel(in.Device)
	if err = s.repo.Register(ctx, user, session); err != nil {
		return AuthResult{}, err
	}
	// The first code goes out right away; a mail failure does not undo the
	// sign-up, the app offers to send it again.
	if s.mailer != nil {
		_ = s.sendCode(ctx, user, domain.PurposeVerifyEmail)
	}
	return AuthResult{Token: token, ExpiresAt: session.ExpiresAt, User: s.public(user)}, nil
}
func (s *Service) Login(ctx context.Context, in LoginInput) (AuthResult, error) {
	return s.login(ctx, in, "mobile")
}

// AdminLogin signs an admin in with the password alone; once a second factor
// is configured (WithAdminSecondFactor) it refuses and AdminSignIn is used.
func (s *Service) AdminLogin(ctx context.Context, in LoginInput) (AuthResult, error) {
	if s.totpBox != nil {
		return AuthResult{}, domain.ErrTwoFactorRequired
	}
	return s.login(ctx, in, "admin")
}
func (s *Service) login(ctx context.Context, in LoginInput, audience string) (AuthResult, error) {
	user, err := s.authenticate(ctx, in, audience)
	if err != nil {
		return AuthResult{}, err
	}
	return s.openSession(ctx, user, audience, in.Device)
}

// authenticate checks the password (with the wrong-password slowdown) and
// that the account may sign in to this audience.
func (s *Service) authenticate(ctx context.Context, in LoginInput, audience string) (domain.User, error) {
	identifier := in.Identifier
	if identifier == "" {
		identifier = in.Email
	}
	user, err := s.repo.UserByLogin(ctx, canonicalEmail(identifier))
	if errors.Is(err, domain.ErrNotFound) {
		_ = bcrypt.CompareHashAndPassword(s.dummyHash, []byte(in.Password))
		slog.WarnContext(ctx, logging.EventLoginFailed, "security", true, "audience", audience, "reason", "unknown_account")
		return domain.User{}, domain.ErrUnauthorized
	}
	if err != nil {
		return domain.User{}, err
	}
	if user.LockedUntil.After(s.now()) {
		slog.WarnContext(ctx, logging.EventLoginLocked, "security", true, "audience", audience, "target_user_id", user.ID)
		return domain.User{}, domain.LoginLockedError{Until: user.LockedUntil}
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(in.Password)) != nil {
		until, err := s.repo.LoginFailed(ctx, user.ID, s.now())
		if err != nil {
			return domain.User{}, err
		}
		slog.WarnContext(ctx, logging.EventLoginFailed, "security", true, "audience", audience, "reason", "wrong_password", "target_user_id", user.ID, "locked", !until.IsZero())
		if !until.IsZero() {
			return domain.User{}, domain.LoginLockedError{Until: until}
		}
		return domain.User{}, domain.ErrUnauthorized
	}
	if err = s.repo.LoginSucceeded(ctx, user.ID); err != nil {
		return domain.User{}, err
	}
	// Hashes from before the cost was raised are upgraded on the next sign-in.
	if cost, err := bcrypt.Cost([]byte(user.PasswordHash)); err == nil && cost < PasswordCost {
		if hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), PasswordCost); err == nil {
			_ = s.repo.RehashPassword(ctx, user.ID, string(hash))
		}
	}
	// The application state is only revealed after the password matched.
	if !user.Active {
		switch user.ApprovalStatus {
		case "pending":
			return domain.User{}, domain.ErrPendingApproval
		case "rejected":
			return domain.User{}, domain.ErrApplicationRejected
		}
		return domain.User{}, domain.ErrUnauthorized
	}
	if (user.Role == "admin") != (audience == "admin") {
		return domain.User{}, domain.ErrWrongPortal
	}
	return user, nil
}

func (s *Service) openSession(ctx context.Context, user domain.User, audience, device string) (AuthResult, error) {
	token, session, err := s.newSession(user.ID)
	if err != nil {
		return AuthResult{}, err
	}
	session.AuthVersion = user.AuthVersion
	session.Audience = audience
	session.Device = deviceLabel(device)
	if audience == "admin" && session.ExpiresAt.After(s.now().Add(8*time.Hour)) {
		session.ExpiresAt = s.now().UTC().Add(8 * time.Hour)
	}
	if err = s.repo.CreateSession(ctx, session); err != nil {
		return AuthResult{}, err
	}
	return AuthResult{Token: token, ExpiresAt: session.ExpiresAt, User: s.public(user)}, nil
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
	// Last use for the Active sessions screen; written at most every 5 minutes.
	if audience == "mobile" {
		_ = s.repo.TouchSession(ctx, session.TokenHash, s.now().UTC())
	}
	public := s.public(user)
	if session.ActingUserID != "" {
		delegate, err := s.delegate(ctx, user.ID, session.ActingUserID, session.ActingAuthVersion)
		if err != nil {
			return PublicUser{}, err
		}
		public.Delegate = delegate
		// The club's sign-in email stays private from the coach running it.
		public.Email = ""
	}
	// The request's log lines carry the account id from here on.
	logging.SetUser(ctx, user.ID, user.Role, session.ActingUserID)
	return public, nil
}

// delegate re-checks a switched session on every request: the coach is still
// active with unchanged credentials and still active staff of the club.
func (s *Service) delegate(ctx context.Context, clubID, coachID string, authVersion int) (*Delegate, error) {
	coach, err := s.repo.UserByID(ctx, coachID)
	if errors.Is(err, domain.ErrNotFound) {
		return nil, domain.ErrUnauthorized
	}
	if err != nil {
		return nil, err
	}
	if !coach.Active || coach.Role != "coach" || coach.AuthVersion != authVersion {
		return nil, domain.ErrUnauthorized
	}
	permissions, err := s.repo.StaffPermissions(ctx, clubID, coachID)
	if errors.Is(err, domain.ErrNotFound) {
		return nil, domain.ErrUnauthorized
	}
	if err != nil {
		return nil, err
	}
	return &Delegate{CoachID: coach.ID, CoachName: coach.FullName, Permissions: permissions}, nil
}

// Delegation returns the club sections a switched (coach-as-club) session may
// use, with ok=false for every other request. It is the cheap first check of
// the API guard; Me still validates the whole session in each handler.
func (s *Service) Delegation(ctx context.Context, token string) (permissions []string, ok bool, err error) {
	if len(token) != 43 {
		return nil, false, nil
	}
	session, err := s.repo.SessionByHash(ctx, HashToken(token))
	if errors.Is(err, domain.ErrNotFound) {
		return nil, false, nil
	}
	if err != nil || session.ActingUserID == "" {
		return nil, false, err
	}
	permissions, err = s.repo.StaffPermissions(ctx, session.UserID, session.ActingUserID)
	if errors.Is(err, domain.ErrNotFound) {
		return nil, true, domain.ErrUnauthorized
	}
	return permissions, true, err
}

// SwitchToClub opens a club session for a coach who is active staff of that
// club. It needs the coach's own session; a switched session cannot switch
// again. The coach keeps their session and returns by dropping this one.
func (s *Service) SwitchToClub(ctx context.Context, token, clubID string) (AuthResult, error) {
	coach, err := s.Me(ctx, token)
	if err != nil {
		return AuthResult{}, err
	}
	if coach.Role != "coach" || coach.Delegate != nil {
		return AuthResult{}, domain.ErrForbidden
	}
	if _, err := s.repo.StaffPermissions(ctx, clubID, coach.ID); errors.Is(err, domain.ErrNotFound) {
		return AuthResult{}, domain.ErrForbidden
	} else if err != nil {
		return AuthResult{}, err
	}
	coachUser, err := s.repo.UserByID(ctx, coach.ID)
	if err != nil {
		return AuthResult{}, err
	}
	club, err := s.repo.UserByID(ctx, clubID)
	if errors.Is(err, domain.ErrNotFound) {
		return AuthResult{}, domain.ErrForbidden
	}
	if err != nil {
		return AuthResult{}, err
	}
	if club.Role != "club" || !club.Active {
		return AuthResult{}, domain.ErrForbidden
	}
	clubToken, session, err := s.newSession(club.ID)
	if err != nil {
		return AuthResult{}, err
	}
	session.AuthVersion = club.AuthVersion
	session.ActingUserID = coachUser.ID
	session.ActingAuthVersion = coachUser.AuthVersion
	// A club session lasts a working day; the app then returns to the coach.
	if limit := s.now().UTC().Add(SwitchedSessionTTL); session.ExpiresAt.After(limit) {
		session.ExpiresAt = limit
	}
	if err := s.repo.CreateSession(ctx, session); errors.Is(err, domain.ErrUnauthorized) {
		return AuthResult{}, domain.ErrForbidden
	} else if err != nil {
		return AuthResult{}, err
	}
	public, err := s.Me(ctx, clubToken)
	if err != nil {
		return AuthResult{}, err
	}
	s.audit(ctx, audit.Entry{ActorType: "user", ActorID: club.ID, DelegatedBy: coachUser.ID, Action: "auth.switch", TargetType: "user", TargetID: club.ID})
	return AuthResult{Token: clubToken, ExpiresAt: session.ExpiresAt, User: public}, nil
}

// DeleteAccount permanently removes the signed-in mobile account after the
// password is confirmed. Profile, posts, follows, requests and sessions go
// with it; payment records keep the amount but lose the account link.
func (s *Service) DeleteAccount(ctx context.Context, token, password string) error {
	public, err := s.Me(ctx, token)
	if err != nil {
		return err
	}
	// A coach acting for a club can never delete the club.
	if public.Delegate != nil {
		return domain.ErrForbidden
	}
	user, err := s.repo.UserByID(ctx, public.ID)
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		return ValidationError{"password": "Şifre doğru değil."}
	}
	if err = s.repo.DeleteUser(ctx, user.ID); err != nil {
		return err
	}
	s.audit(ctx, audit.Entry{ActorType: "user", ActorID: user.ID, Action: "auth.account.deleted", Details: map[string]any{"role": user.Role}})
	return nil
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
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), PasswordCost)
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
