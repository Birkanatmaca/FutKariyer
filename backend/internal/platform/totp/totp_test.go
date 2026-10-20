package totp

import (
	"strings"
	"testing"
	"time"
)

// RFC 6238 appendix B, SHA1, last six digits.
func TestRFCVectors(t *testing.T) {
	secret := []byte("12345678901234567890")
	for unix, want := range map[int64]string{59: "287082", 1111111109: "081804", 1111111111: "050471", 1234567890: "005924", 2000000000: "279037"} {
		if got := Code(secret, unix/30); got != want {
			t.Errorf("t=%d: %s, want %s", unix, got, want)
		}
	}
}

func TestVerifyWindowAndReplay(t *testing.T) {
	secret, _ := NewSecret()
	now := time.Unix(1_800_000_000, 0)
	code := Code(secret, Step(now)-1)
	step, ok := Verify(secret, code, now, 0)
	if !ok || step != Step(now)-1 {
		t.Fatal("previous step must be accepted")
	}
	if _, ok = Verify(secret, code, now, step); ok {
		t.Fatal("a used code must not work again")
	}
	if _, ok = Verify(secret, Code(secret, Step(now)-2), now, 0); ok {
		t.Fatal("codes older than one step are refused")
	}
	if _, ok = Verify(secret, "12345", now, 0); ok {
		t.Fatal("short code accepted")
	}
	uri := URI(secret, "admin", "Fut Career")
	if !strings.HasPrefix(uri, "otpauth://totp/Fut%20Career:admin?") || !strings.Contains(uri, "secret="+Encode(secret)) {
		t.Fatalf("uri: %s", uri)
	}
}
