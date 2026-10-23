package transport_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	adminapp "futcareer/backend/internal/admin/application"
	admindata "futcareer/backend/internal/admin/data"
	admintransport "futcareer/backend/internal/admin/transport"
	authapp "futcareer/backend/internal/auth/application"
	authdata "futcareer/backend/internal/auth/data"
	discoveryapp "futcareer/backend/internal/discovery/application"
	discoverydata "futcareer/backend/internal/discovery/data"
	discoverydomain "futcareer/backend/internal/discovery/domain"
	discoverytransport "futcareer/backend/internal/discovery/transport"
	paymentapp "futcareer/backend/internal/payments/application"
	paymentdata "futcareer/backend/internal/payments/data"
	paymenttransport "futcareer/backend/internal/payments/transport"
	playerapp "futcareer/backend/internal/players/application"
	playerdata "futcareer/backend/internal/players/data"
	proapp "futcareer/backend/internal/pro/application"
	prodata "futcareer/backend/internal/pro/data"
	protransport "futcareer/backend/internal/pro/transport"
	teamsdata "futcareer/backend/internal/teams/data"
	"futcareer/backend/internal/testsupport/testpostgres"
)

const webhookSecret = "test-webhook-secret-with-at-least-32-bytes"

type fakeCheckout struct{ requests []paymentapp.CheckoutRequest }

func (f *fakeCheckout) CreateCheckout(_ context.Context, input paymentapp.CheckoutRequest) (paymentapp.CheckoutSession, error) {
	f.requests = append(f.requests, input)
	return paymentapp.CheckoutSession{Provider: "test-provider", ProviderPaymentID: "pay-" + input.OrderID, CheckoutURL: "https://checkout.example/" + input.OrderID}, nil
}

func TestProMembershipVisitorsAndPayments(t *testing.T) {
	db := testpostgres.New(t)
	ctx := context.Background()
	auth := authapp.New(authdata.New(db.DB), time.Hour)
	admin := adminapp.New(admindata.New(db.DB))
	players := playerapp.New(playerdata.New(db.DB))
	quotas := teamsdata.New(db.DB)
	discovery := discoveryapp.New(discoverydata.New(db.DB))
	adapter := &fakeCheckout{}
	payments := paymentapp.New(paymentdata.New(db.DB), adapter)
	pro := proapp.New(prodata.New(db.DB))

	register := func(name, email, footballType string) authapp.AuthResult {
		t.Helper()
		result, err := auth.Register(ctx, authapp.RegisterInput{TermsAccepted: true, FullName: name, Email: email, Password: "test-password-123", Role: "player", FootballType: footballType, LicenseStatus: "licensed"})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := players.Save(ctx, result.User.ID, playerapp.SaveInput{Position: "Forvet", DominantFoot: "right", ExperienceYears: 3, Availability: "seeking_team", CurrentClub: "Beyan Spor", Discoverable: true, FootballType: footballType, LicenseStatus: "licensed"}); err != nil {
			t.Fatal(err)
		}
		return result
	}
	owner := register("Profil Sahibi", "owner@example.com", "amateur")
	visitor := register("Acik Ziyaretci", "visitor@example.com", "amateur")
	buyer := register("Pro Alici", "buyer@example.com", "halisaha")
	club, err := admin.Create(ctx, adminapp.CreateInput{AccountInput: authapp.AccountInput{FullName: "Dogrulanmis Kulup", Username: "verified.club", Password: "test-password-123"}, FootballType: "amateur"}, true)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.DB.ExecContext(ctx, `UPDATE users SET verified=true WHERE id=$1`, club.ID); err != nil {
		t.Fatal(err)
	}
	clubSession, err := auth.Login(ctx, authapp.LoginInput{Identifier: "verified.club", Password: "test-password-123"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = admin.Bootstrap(ctx, authapp.AccountInput{FullName: "Test Admin", Username: "test.admin", Password: "test-password-123"}); err != nil {
		t.Fatal(err)
	}
	adminSession, err := auth.AdminLogin(ctx, authapp.LoginInput{Identifier: "test.admin", Password: "test-password-123"})
	if err != nil {
		t.Fatal(err)
	}

	routes := http.NewServeMux()
	publicPayments := paymenttransport.NewPublic(auth, payments, webhookSecret)
	routes.Handle("/v1/payments/", publicPayments)
	routes.Handle("/v1/me/pro-payments", publicPayments)
	routes.Handle("/v1/me/team-request-payments", publicPayments)
	proHandler := protransport.New(auth, pro)
	routes.Handle("/v1/me/pro", proHandler)
	routes.Handle("/v1/me/pro/", proHandler)
	routes.Handle("/v1/me/", discoverytransport.New(auth, discovery))
	routes.Handle("/v1/discovery/", discoverytransport.New(auth, discovery))
	features := http.NewServeMux()
	adminPayments := paymenttransport.NewAdmin(payments)
	features.Handle("/v1/admin/payments", adminPayments)
	features.Handle("/v1/admin/payments/", adminPayments)
	features.Handle("/v1/admin/users/", protransport.NewAdmin(pro))
	browser, err := admintransport.BrowserOrigin("http://localhost:5175", false)
	if err != nil {
		t.Fatal(err)
	}
	routes.Handle("/v1/admin/", admintransport.New(auth, admin, browser, features))

	call := func(method, path, token string, body any, status int) *httptest.ResponseRecorder {
		t.Helper()
		var reader *bytes.Reader
		if body != nil {
			raw, _ := json.Marshal(body)
			reader = bytes.NewReader(raw)
		} else {
			reader = bytes.NewReader(nil)
		}
		r := httptest.NewRequest(method, path, reader)
		r.Header.Set("Content-Type", "application/json")
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		routes.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("%s %s: got %d want %d: %s", method, path, w.Code, status, w.Body)
		}
		return w
	}
	webhook := func(event map[string]string, status int) {
		t.Helper()
		raw, _ := json.Marshal(event)
		r := httptest.NewRequest("POST", "/v1/payments/webhook", bytes.NewReader(raw))
		r.Header.Set("X-FutCareer-Signature", paymentapp.SignPayload([]byte(webhookSecret), raw))
		w := httptest.NewRecorder()
		routes.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("webhook: got %d want %d: %s", w.Code, status, w.Body)
		}
	}
	type proStatus struct {
		Pro struct {
			Active          bool       `json:"active"`
			ExpiresAt       *time.Time `json:"expiresAt"`
			PrivateBrowsing bool       `json:"privateBrowsing"`
			BonusCredits    int        `json:"bonusCredits"`
		} `json:"pro"`
	}
	status := func(token string) proStatus {
		t.Helper()
		var out proStatus
		if err := json.Unmarshal(call("GET", "/v1/me/pro", token, nil, 200).Body.Bytes(), &out); err != nil {
			t.Fatal(err)
		}
		return out
	}
	visitors := func(token string) (discoveryapp.Visitors, string) {
		t.Helper()
		w := call("GET", "/v1/me/profile-visitors", token, nil, 200)
		var out discoveryapp.Visitors
		if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
			t.Fatal(err)
		}
		return out, w.Body.String()
	}
	view := func(viewer authapp.AuthResult, role, id string) {
		t.Helper()
		if _, err := discovery.Get(ctx, discoverydomain.Viewer{ID: viewer.User.ID, Role: viewer.User.Role, Verified: viewer.User.Verified}, role, id); err != nil {
			t.Fatal(err)
		}
	}

	// Default plan from the migration: 30 days, +3 rights, 49 TL, on sale.
	var plan struct {
		Plan struct {
			ID           string `json:"id"`
			Days         int    `json:"days"`
			BonusCredits int    `json:"bonusCredits"`
			AmountMinor  int64  `json:"amountMinor"`
			Currency     string `json:"currency"`
			Active       bool   `json:"active"`
		} `json:"plan"`
		CheckoutEnabled bool `json:"checkoutEnabled"`
	}
	if err := json.Unmarshal(call("GET", "/v1/payments/pro-plan", buyer.Token, nil, 200).Body.Bytes(), &plan); err != nil {
		t.Fatal(err)
	}
	if plan.Plan.Days != 30 || plan.Plan.BonusCredits != 3 || plan.Plan.AmountMinor != 4900 || plan.Plan.Currency != "TRY" || !plan.Plan.Active || !plan.CheckoutEnabled {
		t.Fatalf("default pro plan: %+v", plan)
	}

	// Free users: no Pro, the private browsing setting is refused.
	if s := status(owner.Token); s.Pro.Active || s.Pro.ExpiresAt != nil {
		t.Fatalf("new account is not Pro: %+v", s)
	}
	call("PUT", "/v1/me/pro/settings", buyer.Token, map[string]bool{"privateBrowsing": true}, 403)
	call("PUT", "/v1/me/pro/settings", buyer.Token, map[string]any{"privateBrowsing": "yes"}, 422)

	// Purchase: checkout creates a pending pro order; nothing activates before the webhook.
	var order struct {
		OrderID string `json:"orderId"`
	}
	if err := json.Unmarshal(call("POST", "/v1/me/pro-payments", buyer.Token, map[string]string{"planId": plan.Plan.ID}, 201).Body.Bytes(), &order); err != nil {
		t.Fatal(err)
	}
	if last := adapter.requests[len(adapter.requests)-1]; last.Product != "pro" || last.AmountMinor != 4900 || last.Credits != 0 {
		t.Fatalf("checkout request: %+v", last)
	}
	if status(buyer.Token).Pro.Active {
		t.Fatal("pro must not activate before the signed webhook")
	}
	paid := map[string]string{"eventId": "evt-1", "orderId": order.OrderID, "provider": "test-provider", "providerPaymentId": "pay-" + order.OrderID, "status": "paid"}
	webhook(paid, 204)
	first := status(buyer.Token)
	if !first.Pro.Active || first.Pro.BonusCredits != 3 || first.Pro.ExpiresAt == nil || time.Until(*first.Pro.ExpiresAt) < 29*24*time.Hour || time.Until(*first.Pro.ExpiresAt) > 31*24*time.Hour {
		t.Fatalf("activation: %+v", first)
	}
	// Replays and a second paid event for the same order grant nothing more.
	webhook(paid, 204)
	paid["eventId"] = "evt-2"
	webhook(paid, 204)
	again := status(buyer.Token)
	if again.Pro.BonusCredits != 3 || !again.Pro.ExpiresAt.Equal(*first.Pro.ExpiresAt) {
		t.Fatalf("webhook must be idempotent: %+v", again)
	}
	quota, err := quotas.Quota(ctx, buyer.User.ID)
	if err != nil || quota.Pro != 3 || quota.Limit != 6 || quota.Remaining != 6 {
		t.Fatalf("pro rights counted once as a separate source: %+v %v", quota, err)
	}

	// Renewal extends from the current expiry, not from now.
	if err := json.Unmarshal(call("POST", "/v1/me/pro-payments", buyer.Token, map[string]string{"planId": plan.Plan.ID}, 201).Body.Bytes(), &order); err != nil {
		t.Fatal(err)
	}
	webhook(map[string]string{"eventId": "evt-3", "orderId": order.OrderID, "provider": "test-provider", "providerPaymentId": "pay-" + order.OrderID, "status": "paid"}, 204)
	renewed := status(buyer.Token)
	if renewed.Pro.BonusCredits != 6 || renewed.Pro.ExpiresAt.Sub(*first.Pro.ExpiresAt) < 29*24*time.Hour {
		t.Fatalf("renewal: %+v", renewed)
	}
	// A refund removes that period's rights and time.
	webhook(map[string]string{"eventId": "evt-4", "orderId": order.OrderID, "provider": "test-provider", "providerPaymentId": "pay-" + order.OrderID, "status": "refunded"}, 204)
	refunded := status(buyer.Token)
	if refunded.Pro.BonusCredits != 3 || refunded.Pro.ExpiresAt.Sub(*first.Pro.ExpiresAt).Abs() > time.Minute {
		t.Fatalf("refund: %+v", refunded)
	}

	// Admin payment history lists Pro orders by product.
	if body := call("GET", "/v1/admin/payments?page=1&pageSize=10", adminSession.Token, nil, 200).Body.String(); !strings.Contains(body, `"product":"pro"`) {
		t.Fatalf("admin payments: %s", body)
	}

	// Views: a public player, the verified club and the Pro buyer browsing privately.
	call("PUT", "/v1/me/pro/settings", buyer.Token, map[string]bool{"privateBrowsing": true}, 200)
	if !status(buyer.Token).Pro.PrivateBrowsing {
		t.Fatal("private browsing was not saved")
	}
	view(visitor, "player", owner.User.ID)
	view(clubSession, "player", owner.User.ID)
	view(buyer, "player", owner.User.ID)
	view(buyer, "player", owner.User.ID) // the same UTC day counts once

	free, body := visitors(owner.Token)
	if free.IsPro || free.Summary.Window.Visitors != 3 || free.Summary.Window.Visits != 3 || free.Summary.Window.ByRole.Hidden != 1 || free.Summary.Window.ByRole.Club != 1 || free.Summary.Week.Visitors != 3 {
		t.Fatalf("free summary: %+v", free.Summary)
	}
	for _, leaked := range []string{buyer.User.ID, "Pro Alici", visitor.User.ID, "Acik Ziyaretci", "buyer@example.com", "visitor@example.com", `"email"`} {
		if strings.Contains(body, leaked) {
			t.Fatalf("free payload leaked %q: %s", leaked, body)
		}
	}
	// The most recent non-private visitor (the club) is the only revealed row.
	revealed := 0
	for _, row := range free.Items {
		if row.Kind == discoveryapp.VisitorRowFull {
			revealed++
			if row.Visitor.ID != club.ID || row.Visitor.CanOpen != true {
				t.Fatalf("revealed row: %+v", row.Visitor)
			}
		}
	}
	if revealed != 1 || len(free.Items) != 3 {
		t.Fatalf("free items: %+v", free.Items)
	}

	// Admin grant makes the owner Pro (+30 days, +3 rights once per grant); Pro sees Pro.
	call("POST", "/v1/admin/users/"+owner.User.ID+"/pro", adminSession.Token, map[string]string{"action": "grant"}, 200)
	if s := status(owner.Token); !s.Pro.Active || s.Pro.BonusCredits != 3 {
		t.Fatalf("admin grant: %+v", s)
	}
	full, _ := visitors(owner.Token)
	if !full.IsPro || full.Summary.Window.ByRole.Hidden != 0 || full.Summary.Window.ByRole.Player != 2 || len(full.Items) != 3 {
		t.Fatalf("pro summary: %+v", full)
	}
	if full.Items[0].Visitor == nil || full.Items[0].Visitor.ID != club.ID {
		t.Fatalf("verified club ranks first: %+v", full.Items[0])
	}
	sawPrivate := false
	for _, row := range full.Items {
		if row.Kind != discoveryapp.VisitorRowFull || row.Visitor == nil {
			t.Fatalf("pro rows carry identities: %+v", row)
		}
		if row.Visitor.ID == buyer.User.ID {
			sawPrivate = row.Visitor.Private && row.Visitor.IsPro
		}
	}
	if !sawPrivate {
		t.Fatal("a Pro owner sees the private Pro visitor's identity")
	}
	// Pro badge in discovery.
	if body := call("GET", "/v1/discovery/players?page=1", visitor.Token, nil, 200).Body.String(); !strings.Contains(body, `"isPro":true`) {
		t.Fatalf("discovery pro badge: %s", body)
	}

	// Revoke ends Pro immediately (expired = not Pro) but keeps granted rights.
	call("POST", "/v1/admin/users/"+owner.User.ID+"/pro", adminSession.Token, map[string]string{"action": "revoke"}, 200)
	if s := status(owner.Token); s.Pro.Active || s.Pro.BonusCredits != 3 {
		t.Fatalf("revoke: %+v", s)
	}
	if again, _ := visitors(owner.Token); again.IsPro || again.Summary.Window.ByRole.Hidden != 1 {
		t.Fatalf("revoked owner is free again: %+v", again.Summary)
	}
	// Expiry is enforced on every request.
	if _, err := db.DB.ExecContext(ctx, `UPDATE pro_memberships SET expires_at=now()-interval '1 second' WHERE user_id=$1`, buyer.User.ID); err != nil {
		t.Fatal(err)
	}
	if s := status(buyer.Token); s.Pro.Active || s.Pro.PrivateBrowsing {
		t.Fatalf("expired membership: %+v", s)
	}
	call("PUT", "/v1/me/pro/settings", buyer.Token, map[string]bool{"privateBrowsing": false}, 403)
	call("POST", "/v1/admin/users/"+owner.User.ID+"/pro", adminSession.Token, map[string]string{"action": "extend"}, 422)
	call("POST", "/v1/admin/users/00000000000000000000000000000000/pro", adminSession.Token, map[string]string{"action": "grant"}, 404)
	call("POST", "/v1/admin/users/"+owner.User.ID+"/pro", owner.Token, map[string]string{"action": "grant"}, 401)

	// Price management: admins change price and sale state; an inactive plan cannot be bought.
	call("PUT", "/v1/admin/payments/pro-plan/"+plan.Plan.ID, adminSession.Token, map[string]any{"amountMinor": 5900, "active": false}, 200)
	call("PUT", "/v1/admin/payments/pro-plan/"+plan.Plan.ID, adminSession.Token, map[string]any{"amountMinor": 50, "active": true}, 422)
	call("POST", "/v1/me/pro-payments", buyer.Token, map[string]string{"planId": plan.Plan.ID}, 404)
	call("PUT", "/v1/admin/payments/pro-plan/"+plan.Plan.ID, adminSession.Token, map[string]any{"amountMinor": 5900, "active": true}, 200)
	call("POST", "/v1/me/pro-payments", buyer.Token, map[string]string{"planId": plan.Plan.ID}, 201)
	if last := adapter.requests[len(adapter.requests)-1]; last.AmountMinor != 5900 {
		t.Fatalf("updated price not used: %+v", last)
	}
	// Team-right packages keep their own product and are unaffected.
	call("POST", "/v1/me/team-request-payments", buyer.Token, map[string]string{"packageId": "00000000000000000000000000000002"}, 201)
	if last := adapter.requests[len(adapter.requests)-1]; last.Product != "team_rights" || last.Credits != 2 {
		t.Fatalf("package checkout: %+v", last)
	}
}
