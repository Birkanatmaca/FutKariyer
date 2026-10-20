package secretbox

import (
	"bytes"
	"testing"
)

func TestSealOpen(t *testing.T) {
	box, err := FromKey("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff")
	if err != nil {
		t.Fatal(err)
	}
	sealed, err := box.Seal([]byte("secret"))
	if err != nil || bytes.Contains(sealed, []byte("secret")) {
		t.Fatalf("seal: %v", err)
	}
	plain, err := box.Open(sealed)
	if err != nil || string(plain) != "secret" {
		t.Fatalf("open: %q %v", plain, err)
	}
	sealed[len(sealed)-1] ^= 1
	if _, err = box.Open(sealed); err == nil {
		t.Fatal("tampered value opened")
	}
	if _, err = FromKey("short"); err == nil {
		t.Fatal("short key accepted")
	}
}
