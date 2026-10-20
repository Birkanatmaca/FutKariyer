package application

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"log/slog"
	"strings"
	"time"

	"futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/platform/audit"
	"futcareer/backend/internal/platform/logging"
	"futcareer/backend/internal/platform/secretbox"
	"futcareer/backend/internal/platform/totp"
)

// Admin two-factor sign-in (20 Oct 2026). After the password, an admin
// enters a 6-digit authenticator code; the first time they enrol by adding
// the key to an authenticator app, and get ten single-use recovery codes.
const (
	challengeTTL      = 5 * time.Minute
	challengeAttempts = 5
	recoveryCodes     = 10
	totpIssuer        = "Fut Career"
)

// WithAdminSecondFactor turns admin 2FA on with the key that seals
// authenticator secrets (ADMIN_TOTP_KEY).
func (s *Service) WithAdminSecondFactor(box *secretbox.Box) *Service {
	s.totpBox = box
	return s
}

// SecondFactorEnabled reports whether admins must use an authenticator.
func (s *Service) SecondFactorEnabled() bool { return s.totpBox != nil }

// AdminChallenge is the second sign-in step. Setup is true when the admin has
// no authenticator yet: Secret and URI are then shown once to add it.
type AdminChallenge struct {
	Token  string `json:"challenge"`
	Setup  bool   `json:"setup"`
	Secret string `json:"secret,omitempty"`
	URI    string `json:"otpauthUri,omitempty"`
}

// AdminSignInResult is either a session (2FA off) or a challenge.
type AdminSignInResult struct {
	Session   *AuthResult
	Challenge *AdminChallenge
}

// AdminSignIn checks an admin's password and returns the second step, or a
// session when 2FA is not configured on this server.
func (s *Service) AdminSignIn(ctx context.Context, in LoginInput) (AdminSignInResult, error) {
	user, err := s.authenticate(ctx, in, "admin")
	if err != nil {
		return AdminSignInResult{}, err
	}
	if s.totpBox == nil {
		session, err := s.openSession(ctx, user, "admin", in.Device)
		if err == nil {
			s.audit(ctx, audit.Entry{ActorType: "admin", ActorID: user.ID, Action: "admin.login", Details: map[string]any{"secondFactor": false}})
		}
		return AdminSignInResult{Session: &session}, err
	}
	factor, err := s.repo.SecondFactor(ctx, user.ID)
	if err != nil {
		return AdminSignInResult{}, err
	}
	token, err := randomToken()
	if err != nil {
		return AdminSignInResult{}, err
	}
	challenge := &AdminChallenge{Token: token}
	var pending []byte
	if !factor.Enabled {
		secret, err := totp.NewSecret()
		if err != nil {
			return AdminSignInResult{}, err
		}
		if pending, err = s.totpBox.Seal(secret); err != nil {
			return AdminSignInResult{}, err
		}
		account := user.Username
		if account == "" {
			account = user.Email
		}
		challenge.Setup = true
		challenge.Secret = totp.Encode(secret)
		challenge.URI = totp.URI(secret, account, totpIssuer)
	}
	if err = s.repo.CreateChallenge(ctx, HashToken(token), user.ID, pending, s.now().UTC().Add(challengeTTL)); err != nil {
		return AdminSignInResult{}, err
	}
	return AdminSignInResult{Challenge: challenge}, nil
}

// AdminVerifyResult is the session plus, right after enrolment, the recovery
// codes to write down (shown once).
type AdminVerifyResult struct {
	AuthResult
	RecoveryCodes []string `json:"recoveryCodes,omitempty"`
}

// AdminVerify finishes an admin sign-in with an authenticator code or, for an
// enrolled admin, an unused recovery code.
func (s *Service) AdminVerify(ctx context.Context, challengeToken, code, device string) (AdminVerifyResult, error) {
	if s.totpBox == nil {
		return AdminVerifyResult{}, domain.ErrChallengeInvalid
	}
	hash := HashToken(challengeToken)
	challenge, err := s.repo.Challenge(ctx, hash, s.now())
	if err != nil {
		return AdminVerifyResult{}, err
	}
	if challenge.Attempts >= challengeAttempts {
		_ = s.repo.DeleteChallenge(ctx, hash)
		return AdminVerifyResult{}, domain.ErrChallengeInvalid
	}
	user, err := s.repo.UserByID(ctx, challenge.UserID)
	if err != nil {
		return AdminVerifyResult{}, err
	}
	if !user.Active || user.Role != "admin" {
		_ = s.repo.DeleteChallenge(ctx, hash)
		return AdminVerifyResult{}, domain.ErrChallengeInvalid
	}
	fail := func() (AdminVerifyResult, error) {
		if err := s.repo.ChallengeFailed(ctx, hash); err != nil {
			return AdminVerifyResult{}, err
		}
		s.audit(ctx, audit.Entry{ActorType: "admin", ActorID: user.ID, Action: "admin.2fa.failed"})
		return AdminVerifyResult{}, domain.ErrCodeInvalid
	}
	out := AdminVerifyResult{}
	if challenge.PendingSecret != nil {
		secret, err := s.totpBox.Open(challenge.PendingSecret)
		if err != nil {
			return AdminVerifyResult{}, err
		}
		step, ok := totp.Verify(secret, code, s.now(), 0)
		if !ok {
			return fail()
		}
		codes, hashes, err := newRecoveryCodes(user.ID)
		if err != nil {
			return AdminVerifyResult{}, err
		}
		if err = s.repo.EnableSecondFactor(ctx, user.ID, challenge.PendingSecret, step, hashes); err != nil {
			return AdminVerifyResult{}, err
		}
		out.RecoveryCodes = codes
		s.audit(ctx, audit.Entry{ActorType: "admin", ActorID: user.ID, Action: "admin.2fa.enabled"})
	} else {
		factor, err := s.repo.SecondFactor(ctx, user.ID)
		if err != nil {
			return AdminVerifyResult{}, err
		}
		if !factor.Enabled {
			return AdminVerifyResult{}, domain.ErrChallengeInvalid
		}
		secret, err := s.totpBox.Open(factor.Sealed)
		if err != nil {
			return AdminVerifyResult{}, err
		}
		if step, ok := totp.Verify(secret, code, s.now(), factor.LastStep); ok {
			if used, err := s.repo.UseStep(ctx, user.ID, step); err != nil {
				return AdminVerifyResult{}, err
			} else if !used {
				return fail()
			}
		} else if normalized := normalizeRecovery(code); len(normalized) == 8 {
			used, err := s.repo.UseRecoveryCode(ctx, user.ID, recoveryHash(user.ID, normalized))
			if err != nil {
				return AdminVerifyResult{}, err
			}
			if !used {
				return fail()
			}
			s.audit(ctx, audit.Entry{ActorType: "admin", ActorID: user.ID, Action: "admin.2fa.recovery_used"})
		} else {
			return fail()
		}
	}
	if err = s.repo.DeleteChallenge(ctx, hash); err != nil {
		return AdminVerifyResult{}, err
	}
	session, err := s.openSession(ctx, user, "admin", device)
	if err != nil {
		return AdminVerifyResult{}, err
	}
	s.audit(ctx, audit.Entry{ActorType: "admin", ActorID: user.ID, Action: "admin.login", Details: map[string]any{"secondFactor": true}})
	out.AuthResult = session
	return out, nil
}

// ResetAdminSecondFactor is the server command for an admin who lost both
// the phone and the recovery codes: the next sign-in enrols again.
func (s *Service) ResetAdminSecondFactor(ctx context.Context, login string) error {
	return s.repo.ResetSecondFactor(ctx, canonicalEmail(login))
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// Recovery codes look like "k7m2-x9qp": 8 characters of an unambiguous
// alphabet, about 40 bits each.
const recoveryAlphabet = "abcdefghjkmnpqrstuvwxyz23456789"

func newRecoveryCodes(userID string) ([]string, []string, error) {
	codes := make([]string, 0, recoveryCodes)
	hashes := make([]string, 0, recoveryCodes)
	for len(codes) < recoveryCodes {
		raw := make([]byte, 8)
		if _, err := rand.Read(raw); err != nil {
			return nil, nil, err
		}
		var b strings.Builder
		for i, v := range raw {
			if i == 4 {
				b.WriteByte('-')
			}
			b.WriteByte(recoveryAlphabet[int(v)%len(recoveryAlphabet)])
		}
		code := b.String()
		codes = append(codes, code)
		hashes = append(hashes, recoveryHash(userID, normalizeRecovery(code)))
	}
	return codes, hashes, nil
}

func normalizeRecovery(code string) string {
	return strings.ToLower(strings.NewReplacer("-", "", " ", "").Replace(strings.TrimSpace(code)))
}

func recoveryHash(userID, normalized string) string {
	sum := sha256.Sum256([]byte("recovery\x00" + userID + "\x00" + normalized))
	return hex.EncodeToString(sum[:])
}

// audit records a security event; a failure to write it is logged by the
// caller's request log and never blocks the action.
func (s *Service) audit(ctx context.Context, entry audit.Entry) {
	if err := s.repo.Audit(ctx, entry); err != nil && !errors.Is(err, context.Canceled) {
		auditFailed(ctx, err)
	}
}

func auditFailed(ctx context.Context, err error) {
	slog.ErrorContext(ctx, logging.EventAuditWrite, "error", err)
}

// Audit appends an entry for other handlers (admin writes).
func (s *Service) Audit(ctx context.Context, entry audit.Entry) { s.audit(ctx, entry) }

// AuditDelegatedWrite records a write a coach made while running a club.
func (s *Service) AuditDelegatedWrite(ctx context.Context, token, action, target string) {
	session, err := s.repo.SessionByHash(ctx, HashToken(token))
	if err != nil || session.ActingUserID == "" {
		return
	}
	s.audit(ctx, audit.Entry{ActorType: "user", ActorID: session.UserID, DelegatedBy: session.ActingUserID, Action: "club." + action, TargetID: target})
}
