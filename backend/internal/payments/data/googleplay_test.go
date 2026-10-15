package data

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"futcareer/backend/internal/payments/domain"
)

func newTestGooglePlay(t *testing.T, handler http.HandlerFunc) (*GooglePlay, *int) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	der, _ := x509.MarshalPKCS8PrivateKey(key)
	tokens := 0
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/token" {
			tokens++
			if r.FormValue("grant_type") != "urn:ietf:params:oauth:grant-type:jwt-bearer" || strings.Count(r.FormValue("assertion"), ".") != 2 {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "access", "expires_in": 3600})
			return
		}
		if r.Header.Get("Authorization") != "Bearer access" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		handler(w, r)
	}))
	t.Cleanup(server.Close)
	account, _ := json.Marshal(map[string]string{
		"client_email": "iap@futcareer.iam.gserviceaccount.com",
		"private_key":  string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})),
		"token_uri":    server.URL + "/token",
	})
	play, err := newGooglePlay("com.futcareer.app", account, server.URL+"/apps/", server.Client(), time.Now)
	if err != nil {
		t.Fatal(err)
	}
	return play, &tokens
}

func TestGooglePlayPurchaseStates(t *testing.T) {
	state := 0
	play, tokens := newTestGooglePlay(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/apps/com.futcareer.app/purchases/products/com.futcareer.rights.5/tokens/purchase-token" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"purchaseState": state, "orderId": "GPA.3300-1111-2222-33333", "obfuscatedExternalAccountId": testOrder})
	})
	ctx := context.Background()
	got, err := play.VerifyPurchase(ctx, "com.futcareer.rights.5", "purchase-token")
	want := domain.StoreTransaction{Store: domain.StoreGooglePlay, TransactionID: "GPA.3300-1111-2222-33333", ProductID: "com.futcareer.rights.5", OrderID: testOrder, State: "paid"}
	if err != nil || got != want {
		t.Fatalf("got %+v %v", got, err)
	}
	for value, expected := range map[int]string{1: "failed", 2: "pending"} {
		state = value
		if got, err := play.VerifyPurchase(ctx, "com.futcareer.rights.5", "purchase-token"); err != nil || got.State != expected {
			t.Fatalf("state %d: %+v %v", value, got, err)
		}
	}
	if _, err := play.VerifyPurchase(ctx, "com.futcareer.rights.5", "unknown"); !errors.Is(err, domain.ErrInvalidPurchase) {
		t.Fatalf("unknown token: %v", err)
	}
	if *tokens != 1 {
		t.Fatalf("access token must be cached, requested %d times", *tokens)
	}
}

func ms(at time.Time) string { return strconv.FormatInt(at.UnixMilli(), 10) }

func TestGooglePlayVoidedPurchasesPage(t *testing.T) {
	since := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	play, _ := newTestGooglePlay(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("startTime") != ms(since) {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if r.URL.Query().Get("token") == "" {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"voidedPurchases": []map[string]any{{"purchaseToken": "a", "orderId": "GPA.1", "voidedTimeMillis": ms(since.Add(24 * time.Hour))}},
				"tokenPagination": map[string]any{"nextPageToken": "next"},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"voidedPurchases": []map[string]any{{"purchaseToken": "b", "voidedTimeMillis": ms(since.Add(48 * time.Hour))}}})
	})
	refunds, next, err := play.VoidedSince(context.Background(), since)
	if err != nil || len(refunds) != 2 {
		t.Fatalf("refunds %+v %v", refunds, err)
	}
	if refunds[0].TransactionID != "GPA.1" || refunds[0].EventID != "voided:GPA.1" || !strings.HasPrefix(refunds[1].TransactionID, "token-") {
		t.Fatalf("unexpected refunds %+v", refunds)
	}
	if !next.Equal(since.Add(48 * time.Hour)) {
		t.Fatalf("cursor %v", next)
	}
}
