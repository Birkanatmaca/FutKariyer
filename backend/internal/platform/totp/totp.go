// Package totp implements RFC 6238 time-based one-time passwords (HMAC-SHA1,
// 30-second steps, 6 digits), the format authenticator apps use.
package totp

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"net/url"
	"strings"
	"time"
)

const (
	period = 30
	digits = 6
)

var encoding = base32.StdEncoding.WithPadding(base32.NoPadding)

// NewSecret returns a random 160-bit secret.
func NewSecret() ([]byte, error) {
	secret := make([]byte, 20)
	_, err := rand.Read(secret)
	return secret, err
}

// Encode is the secret as authenticator apps expect it typed in.
func Encode(secret []byte) string { return encoding.EncodeToString(secret) }

// Step is the 30-second counter for a moment.
func Step(t time.Time) int64 { return t.Unix() / period }

// Code is the 6-digit code of a step.
func Code(secret []byte, step int64) string {
	var counter [8]byte
	binary.BigEndian.PutUint64(counter[:], uint64(step))
	mac := hmac.New(sha1.New, secret)
	mac.Write(counter[:])
	sum := mac.Sum(nil)
	offset := sum[len(sum)-1] & 0x0f
	value := binary.BigEndian.Uint32(sum[offset:offset+4]) & 0x7fffffff
	return fmt.Sprintf("%0*d", digits, value%1000000)
}

// Verify accepts the code of the current step or one step either side (clock
// drift) that is newer than lastStep, so a code works once. It returns the
// matched step to store as the new lastStep.
func Verify(secret []byte, code string, now time.Time, lastStep int64) (int64, bool) {
	code = strings.TrimSpace(code)
	if len(code) != digits {
		return 0, false
	}
	current := Step(now)
	for _, step := range []int64{current - 1, current, current + 1} {
		if step > lastStep && hmac.Equal([]byte(Code(secret, step)), []byte(code)) {
			return step, true
		}
	}
	return 0, false
}

// URI is the otpauth:// link authenticator apps open or read from a QR code.
func URI(secret []byte, account, issuer string) string {
	label := url.PathEscape(issuer + ":" + account)
	query := url.Values{"secret": {Encode(secret)}, "issuer": {issuer}, "algorithm": {"SHA1"}, "digits": {"6"}, "period": {"30"}}
	return "otpauth://totp/" + label + "?" + query.Encode()
}
