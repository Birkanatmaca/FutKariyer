// Package secretbox seals small secrets (authenticator keys) with AES-256-GCM
// under a server key, so a database dump alone does not reveal them.
package secretbox

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
)

type Box struct{ aead cipher.AEAD }

// FromKey takes 32 bytes as 64 hex characters or standard base64
// (generate with: openssl rand -hex 32).
func FromKey(raw string) (*Box, error) {
	key, err := hex.DecodeString(raw)
	if err != nil {
		key, err = base64.StdEncoding.DecodeString(raw)
	}
	if err != nil || len(key) != 32 {
		return nil, errors.New("the key must be 32 bytes, hex or base64 (openssl rand -hex 32)")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Box{aead: aead}, nil
}

// Seal returns nonce||ciphertext.
func (b *Box) Seal(plain []byte) ([]byte, error) {
	nonce := make([]byte, b.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return b.aead.Seal(nonce, nonce, plain, nil), nil
}

func (b *Box) Open(sealed []byte) ([]byte, error) {
	if len(sealed) < b.aead.NonceSize() {
		return nil, errors.New("sealed value too short")
	}
	return b.aead.Open(nil, sealed[:b.aead.NonceSize()], sealed[b.aead.NonceSize():], nil)
}
