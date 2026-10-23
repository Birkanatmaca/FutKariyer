package transport_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/auth/data"
	"futcareer/backend/internal/auth/transport"
	"futcareer/backend/internal/platform/logging"
	"futcareer/backend/internal/platform/mail"
	"futcareer/backend/internal/testsupport/testpostgres"
)

type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}
func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

type outbox struct{ last string }

func (o *outbox) Send(_ context.Context, m mail.Message) error { o.last = m.Text; return nil }

// KVKK (20 Oct 2026): sign-up, sign-in, wrong passwords, password reset and
// email verification write log lines, but never an email address, a
// password, a session token or a code.
func TestLogsCarryNoPersonalData(t *testing.T) {
	var logs syncBuffer
	old := slog.Default()
	logging.SetupTo(&logs, "api", "test", "test", "debug")
	t.Cleanup(func() { slog.SetDefault(old) })

	db := testpostgres.New(t)
	mails := &outbox{}
	service := application.New(data.New(db.DB), time.Hour).WithMailer(mails)
	h := logging.Middleware(transport.New(service), nil)
	const email, password, newPassword = "gizli.kisi@example.com", "cok-gizli-sifre-1", "yeni-gizli-sifre-2"
	call := func(method, path, token string, body any) map[string]any {
		t.Helper()
		raw, _ := json.Marshal(body)
		r := httptest.NewRequest(method, path, bytes.NewReader(raw))
		r.Header.Set("Content-Type", "application/json")
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		out := map[string]any{}
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return out
	}
	signup := call("POST", "/v1/auth/register", "", map[string]any{"fullName": "Gizli Kişi", "email": email, "password": password, "role": "player", "footballType": "amateur", "licenseStatus": "licensed", "termsAccepted": true})
	token, _ := signup["token"].(string)
	if token == "" {
		t.Fatalf("sign-up: %v", signup)
	}
	verifyCode := regexp.MustCompile(`\d{6}`).FindString(mails.last)
	call("POST", "/v1/auth/email/verify", token, map[string]string{"code": verifyCode})
	call("POST", "/v1/auth/login", "", map[string]string{"identifier": email, "password": "yanlis-sifre-123"})
	call("POST", "/v1/auth/login", "", map[string]string{"identifier": email, "password": password})
	call("POST", "/v1/auth/password/forgot", "", map[string]string{"email": email})
	resetCode := regexp.MustCompile(`\d{6}`).FindString(mails.last)
	call("POST", "/v1/auth/password/reset", "", map[string]string{"email": email, "code": resetCode, "password": newPassword})

	out := logs.String()
	if !strings.Contains(out, `"event":"auth.login.failed"`) || strings.Count(out, `"event":"http.request"`) < 6 {
		t.Fatalf("expected request and security lines:\n%s", out)
	}
	for _, secret := range []string{email, "gizli.kisi", password, newPassword, "yanlis-sifre", token, verifyCode, resetCode} {
		if secret != "" && strings.Contains(out, secret) {
			t.Errorf("log contains %q", secret)
		}
	}
}
