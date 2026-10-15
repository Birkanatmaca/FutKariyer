// Package googleauth signs service account JWTs and exchanges them for OAuth
// access tokens (Google Play Developer API, Firebase Cloud Messaging).
package googleauth

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Account is the part of a service account JSON key the server needs.
type Account struct {
	ProjectID string
	Email     string
	Key       *rsa.PrivateKey
	TokenURL  string
}

func ParseAccount(raw []byte) (Account, error) {
	var file struct {
		ProjectID   string `json:"project_id"`
		ClientEmail string `json:"client_email"`
		PrivateKey  string `json:"private_key"`
		TokenURI    string `json:"token_uri"`
	}
	if err := json.Unmarshal(raw, &file); err != nil || file.ClientEmail == "" || file.PrivateKey == "" {
		return Account{}, errors.New("service account JSON is invalid")
	}
	tokenURL, err := url.Parse(file.TokenURI)
	if err != nil || tokenURL.Scheme != "https" || tokenURL.Host == "" {
		return Account{}, errors.New("service account token_uri must be HTTPS")
	}
	block, _ := pem.Decode([]byte(file.PrivateKey))
	if block == nil {
		return Account{}, errors.New("service account private key is invalid")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return Account{}, errors.New("service account private key is invalid")
	}
	key, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return Account{}, errors.New("service account key must be RSA")
	}
	return Account{ProjectID: file.ProjectID, Email: file.ClientEmail, Key: key, TokenURL: tokenURL.String()}, nil
}

// TokenSource caches one access token per scope until shortly before expiry.
type TokenSource struct {
	account Account
	scope   string
	client  *http.Client
	now     func() time.Time

	mu        sync.Mutex
	token     string
	expiresAt time.Time
}

func NewTokenSource(account Account, scope string, client *http.Client, now func() time.Time) *TokenSource {
	return &TokenSource{account: account, scope: scope, client: client, now: now}
}

func (t *TokenSource) Token(ctx context.Context) (string, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	now := t.now()
	if t.token != "" && now.Before(t.expiresAt.Add(-time.Minute)) {
		return t.token, nil
	}
	encode := func(value any) string {
		raw, _ := json.Marshal(value)
		return base64.RawURLEncoding.EncodeToString(raw)
	}
	unsigned := encode(map[string]string{"alg": "RS256", "typ": "JWT"}) + "." + encode(map[string]any{
		"iss": t.account.Email, "scope": t.scope, "aud": t.account.TokenURL,
		"iat": now.Unix(), "exp": now.Add(time.Hour).Unix(),
	})
	digest := sha256.Sum256([]byte(unsigned))
	signature, err := rsa.SignPKCS1v15(rand.Reader, t.account.Key, crypto.SHA256, digest[:])
	if err != nil {
		return "", err
	}
	form := url.Values{"grant_type": {"urn:ietf:params:oauth:grant-type:jwt-bearer"}, "assertion": {unsigned + "." + base64.RawURLEncoding.EncodeToString(signature)}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, t.account.TokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := t.client.Do(req)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	var result struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if response.StatusCode != http.StatusOK || json.NewDecoder(io.LimitReader(response.Body, 65536)).Decode(&result) != nil || result.AccessToken == "" {
		return "", fmt.Errorf("google oauth token request failed with HTTP %d", response.StatusCode)
	}
	t.token, t.expiresAt = result.AccessToken, now.Add(time.Duration(result.ExpiresIn)*time.Second)
	return t.token, nil
}
