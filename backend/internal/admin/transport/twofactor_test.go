package transport_test

import (
	"bytes"
	"context"
	"encoding/base32"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	adminapp "futcareer/backend/internal/admin/application"
	admindata "futcareer/backend/internal/admin/data"
	admintransport "futcareer/backend/internal/admin/transport"
	authapp "futcareer/backend/internal/auth/application"
	authdata "futcareer/backend/internal/auth/data"
	"futcareer/backend/internal/platform/audit"
	"futcareer/backend/internal/platform/secretbox"
	"futcareer/backend/internal/platform/totp"
	"futcareer/backend/internal/testsupport/testpostgres"
)

// Admin sign-in with an authenticator (20 Oct 2026): enrol on first sign-in,
// single-use codes, recovery codes, and every admin write in the audit log.
func TestAdminSecondFactorAndAuditLog(t *testing.T) {
	db := testpostgres.New(t)
	ctx := context.Background()
	box, err := secretbox.FromKey("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff")
	if err != nil {
		t.Fatal(err)
	}
	auth := authapp.New(authdata.New(db.DB), time.Hour).WithAdminSecondFactor(box)
	admin := adminapp.New(admindata.New(db.DB))
	if _, err := admin.Bootstrap(ctx, authapp.AccountInput{FullName: "Güvenli Yönetici", Email: "admin@example.com", Username: "safe.admin", Password: "test-password-123"}); err != nil {
		t.Fatal(err)
	}
	browser, _ := admintransport.BrowserOrigin("http://localhost:5175", false)
	features := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) })
	h := audit.Middleware(admintransport.New(auth, admin, browser, features))
	call := func(method, path, bearer string, body any, status int) map[string]any {
		t.Helper()
		raw, _ := json.Marshal(body)
		r := httptest.NewRequest(method, path, bytes.NewReader(raw))
		r.Header.Set("Content-Type", "application/json")
		r.RemoteAddr = "203.0.113.7:5000"
		if bearer != "" {
			r.Header.Set("Authorization", "Bearer "+bearer)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("%s %s: got %d want %d: %s", method, path, w.Code, status, w.Body)
		}
		out := map[string]any{}
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return out
	}
	password := map[string]string{"identifier": "safe.admin", "password": "test-password-123"}

	// The password alone no longer gives a session.
	if _, err := auth.AdminLogin(ctx, authapp.LoginInput{Identifier: "safe.admin", Password: "test-password-123"}); err == nil {
		t.Fatal("password-only admin login must be refused once 2FA is on")
	}
	first := call("POST", "/v1/admin/auth/token", "", password, 200)["twoFactor"].(map[string]any)
	if first["setup"] != true || first["secret"] == "" || first["token"] != nil {
		t.Fatalf("first sign-in must enrol: %v", first)
	}
	secret, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(first["secret"].(string))
	if err != nil {
		t.Fatal(err)
	}
	call("POST", "/v1/admin/auth/token/2fa", "", map[string]string{"challenge": first["challenge"].(string), "code": "000000"}, 422)
	now := time.Now()
	code := totp.Code(secret, totp.Step(now))
	enrolled := call("POST", "/v1/admin/auth/token/2fa", "", map[string]string{"challenge": first["challenge"].(string), "code": code}, 200)
	codes, _ := enrolled["recoveryCodes"].([]any)
	if enrolled["token"] == "" || len(codes) != 10 {
		t.Fatalf("enrolment: %v", enrolled)
	}
	token := enrolled["token"].(string)
	// The challenge is used up.
	call("POST", "/v1/admin/auth/token/2fa", "", map[string]string{"challenge": first["challenge"].(string), "code": code}, 401)

	// Next sign-in asks for the code; the code just used does not work twice.
	second := call("POST", "/v1/admin/auth/token", "", password, 200)["twoFactor"].(map[string]any)
	if second["setup"] != false || second["secret"] != nil {
		t.Fatalf("enrolled admin must not see the key again: %v", second)
	}
	call("POST", "/v1/admin/auth/token/2fa", "", map[string]string{"challenge": second["challenge"].(string), "code": code}, 422)
	// A recovery code works once.
	recovery := codes[0].(string)
	call("POST", "/v1/admin/auth/token/2fa", "", map[string]string{"challenge": second["challenge"].(string), "code": recovery}, 200)
	third := call("POST", "/v1/admin/auth/token", "", password, 200)["twoFactor"].(map[string]any)
	call("POST", "/v1/admin/auth/token/2fa", "", map[string]string{"challenge": third["challenge"].(string), "code": recovery}, 422)
	// Five wrong codes end the challenge.
	for i := 0; i < 4; i++ {
		call("POST", "/v1/admin/auth/token/2fa", "", map[string]string{"challenge": third["challenge"].(string), "code": "000000"}, 422)
	}
	call("POST", "/v1/admin/auth/token/2fa", "", map[string]string{"challenge": third["challenge"].(string), "code": totp.Code(secret, totp.Step(now)+1)}, 401)

	// Admin writes are recorded with the route, the record and the address.
	id := "0123456789abcdef0123456789abcdef"
	call("PUT", "/v1/admin/gifts/"+id, token, map[string]string{}, 204)
	page := call("GET", "/v1/admin/audit?action=admin.PUT", token, nil, 200)
	items := page["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("audit: %v", page)
	}
	row := items[0].(map[string]any)
	if row["action"] != "admin.PUT /v1/admin/gifts/{id}" || row["targetId"] != id || row["actorName"] != "Güvenli Yönetici" || row["ip"] != "203.0.113.7" {
		t.Fatalf("audit row: %v", row)
	}
	all := call("GET", "/v1/admin/audit", token, nil, 200)
	actions := map[string]bool{}
	for _, item := range all["items"].([]any) {
		actions[item.(map[string]any)["action"].(string)] = true
	}
	for _, want := range []string{"admin.2fa.enabled", "admin.2fa.recovery_used", "admin.2fa.failed", "admin.login"} {
		if !actions[want] {
			t.Errorf("missing audit action %s in %v", want, actions)
		}
	}
	// The log cannot be edited.
	if _, err := db.DB.Exec(`UPDATE audit_log SET action='x'`); err == nil {
		t.Fatal("audit log rows must not change")
	}
	if _, err := db.DB.Exec(`DELETE FROM audit_log`); err == nil {
		t.Fatal("recent audit rows must not be deleted")
	}

	// Lost phone: the server command resets 2FA and ends sessions.
	if err := auth.ResetAdminSecondFactor(ctx, "admin@example.com"); err != nil {
		t.Fatal(err)
	}
	call("GET", "/v1/admin/audit", token, nil, 401)
	if again := call("POST", "/v1/admin/auth/token", "", password, 200)["twoFactor"].(map[string]any); again["setup"] != true {
		t.Fatalf("after a reset the admin enrols again: %v", again)
	}
}
