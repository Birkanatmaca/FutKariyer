// Package mail sends transactional email (verification and password reset
// codes). The provider is chosen by MAIL_PROVIDER:
//
//	""        disabled: features that need email say so; nothing is sent
//	"log"     development only: the message is written to the server log
//	"resend"  Resend HTTP API with MAIL_API_KEY and MAIL_FROM
package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

type Message struct {
	To      string
	Subject string
	Text    string
}

// Sender delivers one message or returns an error; it never retries.
type Sender interface {
	Send(ctx context.Context, m Message) error
}

// FromEnv builds the configured sender; nil means email is disabled.
func FromEnv(provider, apiKey, from string) (Sender, error) {
	switch provider {
	case "":
		return nil, nil
	case "log":
		return LogSender{}, nil
	case "resend":
		if apiKey == "" || from == "" {
			return nil, errors.New("MAIL_PROVIDER=resend needs MAIL_API_KEY and MAIL_FROM")
		}
		return &Resend{key: apiKey, from: from, client: &http.Client{Timeout: 10 * time.Second}, url: "https://api.resend.com/emails"}, nil
	}
	return nil, fmt.Errorf("unknown MAIL_PROVIDER %q", provider)
}

// LogSender writes messages to the log instead of sending them. Never use it
// in production: codes would end up in the logs.
type LogSender struct{}

func (LogSender) Send(_ context.Context, m Message) error {
	slog.Info("mail.logged", "to", m.To, "subject", m.Subject, "text", m.Text)
	return nil
}

type Resend struct {
	key, from, url string
	client         *http.Client
}

func (r *Resend) Send(ctx context.Context, m Message) error {
	body, err := json.Marshal(map[string]any{"from": r.from, "to": []string{m.To}, "subject": m.Subject, "text": m.Text})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, r.url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+r.key)
	req.Header.Set("Content-Type", "application/json")
	res, err := r.client.Do(req)
	if err != nil {
		return fmt.Errorf("resend: %w", err)
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 4096))
	if res.StatusCode/100 != 2 {
		return fmt.Errorf("resend: status %d", res.StatusCode)
	}
	return nil
}
