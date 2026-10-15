package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	adminapplication "futcareer/backend/internal/admin/application"
	admindata "futcareer/backend/internal/admin/data"
	admintransport "futcareer/backend/internal/admin/transport"
	"futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/auth/data"
	"futcareer/backend/internal/auth/transport"
	clubapplication "futcareer/backend/internal/clubs/application"
	clubdata "futcareer/backend/internal/clubs/data"
	clubtransport "futcareer/backend/internal/clubs/transport"
	connectionapplication "futcareer/backend/internal/connections/application"
	connectiondata "futcareer/backend/internal/connections/data"
	connectiontransport "futcareer/backend/internal/connections/transport"
	contentapplication "futcareer/backend/internal/content/application"
	contentdata "futcareer/backend/internal/content/data"
	contenttransport "futcareer/backend/internal/content/transport"
	discoveryapplication "futcareer/backend/internal/discovery/application"
	discoverydata "futcareer/backend/internal/discovery/data"
	discoverytransport "futcareer/backend/internal/discovery/transport"
	footballankara "futcareer/backend/internal/football/ankara"
	footballapplication "futcareer/backend/internal/football/application"
	footballprovider "futcareer/backend/internal/football/provider"
	footballtransport "futcareer/backend/internal/football/transport"
	gameapplication "futcareer/backend/internal/games/application"
	gamecatalog "futcareer/backend/internal/games/catalog"
	gamedata "futcareer/backend/internal/games/data"
	gametransport "futcareer/backend/internal/games/transport"
	giftapplication "futcareer/backend/internal/gifts/application"
	giftdata "futcareer/backend/internal/gifts/data"
	gifttransport "futcareer/backend/internal/gifts/transport"
	leagueapplication "futcareer/backend/internal/leagues/application"
	leaguedata "futcareer/backend/internal/leagues/data"
	leaguetransport "futcareer/backend/internal/leagues/transport"
	listingapplication "futcareer/backend/internal/listings/application"
	listingdata "futcareer/backend/internal/listings/data"
	listingtransport "futcareer/backend/internal/listings/transport"
	moderationapplication "futcareer/backend/internal/moderation/application"
	moderationdata "futcareer/backend/internal/moderation/data"
	moderationtransport "futcareer/backend/internal/moderation/transport"
	notificationsapplication "futcareer/backend/internal/notifications/application"
	notificationsdata "futcareer/backend/internal/notifications/data"
	notificationsdomain "futcareer/backend/internal/notifications/domain"
	notificationstransport "futcareer/backend/internal/notifications/transport"
	paymentapplication "futcareer/backend/internal/payments/application"
	paymentdata "futcareer/backend/internal/payments/data"
	paymentdomain "futcareer/backend/internal/payments/domain"
	paymenttransport "futcareer/backend/internal/payments/transport"
	"futcareer/backend/internal/platform/adminweb"
	"futcareer/backend/internal/platform/postgres"
	playerapplication "futcareer/backend/internal/players/application"
	playerdata "futcareer/backend/internal/players/data"
	playertransport "futcareer/backend/internal/players/transport"
	proapplication "futcareer/backend/internal/pro/application"
	prodata "futcareer/backend/internal/pro/data"
	protransport "futcareer/backend/internal/pro/transport"
	registrationdata "futcareer/backend/internal/registrations/data"
	registrationtransport "futcareer/backend/internal/registrations/transport"
	socialapplication "futcareer/backend/internal/social/application"
	socialdata "futcareer/backend/internal/social/data"
	socialtransport "futcareer/backend/internal/social/transport"
	teamsapplication "futcareer/backend/internal/teams/application"
	teamsdata "futcareer/backend/internal/teams/data"
	teamstransport "futcareer/backend/internal/teams/transport"
	tournamentapplication "futcareer/backend/internal/tournaments/application"
	tournamentdata "futcareer/backend/internal/tournaments/data"
	tournamenttransport "futcareer/backend/internal/tournaments/transport"
	"futcareer/backend/migrations"
)

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func main() {
	if err := run(); err != nil {
		slog.Error("Fut Career API stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	allowInsecureAdmin := os.Getenv("ADMIN_ALLOW_INSECURE_HTTP") == "true"
	if allowInsecureAdmin {
		slog.Warn("admin panel allows plain HTTP; sessions and passwords travel unencrypted until HTTPS is configured")
	}
	browser, err := admintransport.BrowserOrigin(env("ADMIN_ORIGIN", "http://localhost:5175"), allowInsecureAdmin)
	if err != nil {
		return err
	}
	paymentAdapterURL := os.Getenv("PAYMENT_ADAPTER_URL")
	paymentAdapterSecret := os.Getenv("PAYMENT_ADAPTER_SECRET")
	var paymentAdapter paymentapplication.CheckoutAdapter
	if paymentAdapterURL != "" || paymentAdapterSecret != "" {
		if paymentAdapterURL == "" || paymentAdapterSecret == "" {
			return errors.New("PAYMENT_ADAPTER_URL and PAYMENT_ADAPTER_SECRET must be configured together")
		}
		paymentAdapter, err = paymentapplication.NewHTTPAdapter(paymentAdapterURL, paymentAdapterSecret)
		if err != nil {
			return err
		}
	}
	ttl, err := time.ParseDuration(env("SESSION_TTL", "720h"))
	if err != nil || ttl <= 0 {
		return errors.New("SESSION_TTL must be a positive duration")
	}
	startup, cancelStartup := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancelStartup()
	db, err := postgres.Open(startup, os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer db.Close()
	if err := migrations.CheckCurrent(startup, db); err != nil {
		return err
	}
	repo := data.New(db)
	if err := repo.DeleteExpiredSessions(startup); err != nil {
		return fmt.Errorf("expired sessions could not be cleaned up: %w", err)
	}
	playerRepo := playerdata.New(db)
	cancelStartup()
	authService := application.New(repo, ttl)
	gameBank, err := gamecatalog.Load()
	if err != nil {
		return err
	}
	routes := http.NewServeMux()
	// League data: ESPN's public site API for the major leagues (no key) and the
	// public TFF Ankara standings page. Both are cached on the server.
	footballService := footballapplication.New(
		footballprovider.New(os.Getenv("ESPN_BASE_URL")),
		footballankara.New(os.Getenv("TFF_ANKARA_BASE_URL")).WithNews(os.Getenv("TFF_ANKARA_NEWS_BASE_URL")),
	)
	routes.Handle("/v1/football/", footballtransport.New(authService, footballService))
	// Kafa Kafaya builds its rounds from the same cached major league standings.
	routes.Handle("/v1/games/", gametransport.New(authService, gameapplication.New(gamedata.New(db), gameBank, footballService)))
	giftService := giftapplication.New(giftdata.New(db))
	playerGifts := gifttransport.NewPlayer(authService, giftService)
	routes.Handle("/v1/gifts", playerGifts)
	routes.Handle("/v1/gifts/", playerGifts)
	routes.Handle("/v1/social/", socialtransport.New(authService, socialapplication.New(socialdata.New(db))))
	contentService := contentapplication.New(contentdata.New(db))
	leagueService := leagueapplication.New(leaguedata.New(db))
	notificationService := notificationsapplication.New(notificationsdata.New(db))
	pushSender, err := pushSender()
	if err != nil {
		return err
	}
	pushService := notificationsapplication.NewPush(notificationsdata.New(db), pushSender)
	notificationsHandler := notificationstransport.New(authService, notificationService, pushService)
	routes.Handle("/v1/me/push-devices", notificationsHandler)
	routes.Handle("/v1/me/notifications", notificationsHandler)
	routes.Handle("/v1/me/notifications/", notificationsHandler)
	paymentService := paymentapplication.New(paymentdata.New(db), paymentAdapter)
	appStore, googlePlay, err := storeVerifiers()
	if err != nil {
		return err
	}
	paymentService.WithStores(appStore, googlePlay)
	adminFeatures := http.NewServeMux()
	adminFeatures.Handle("/v1/admin/content/", contenttransport.NewAdmin(contentService))
	leagueAdminHandler := leaguetransport.NewAdmin(leagueService)
	adminFeatures.Handle("/v1/admin/leagues", leagueAdminHandler)
	adminFeatures.Handle("/v1/admin/leagues/", leagueAdminHandler)
	adminFeatures.Handle("/v1/admin/gifts", gifttransport.NewAdmin(giftService))
	applicationAdmin := registrationtransport.NewAdmin(registrationdata.New(db))
	adminFeatures.Handle("/v1/admin/applications", applicationAdmin)
	adminFeatures.Handle("/v1/admin/applications/", applicationAdmin)
	adminFeatures.Handle("/v1/admin/club-overviews/", clubtransport.NewAdmin(clubapplication.New(clubdata.New(db), leagueService)))
	adminFeatures.Handle("/v1/admin/announcements", notificationstransport.NewAdmin(notificationsapplication.NewAnnouncements(notificationsdata.New(db))))
	moderationService := moderationapplication.New(moderationdata.New(db))
	adminReports := moderationtransport.NewAdmin(moderationService)
	adminFeatures.Handle("/v1/admin/reports", adminReports)
	adminFeatures.Handle("/v1/admin/reports/", adminReports)
	adminPaymentHandler := paymenttransport.NewAdmin(paymentService)
	adminFeatures.Handle("/v1/admin/payments", adminPaymentHandler)
	adminFeatures.Handle("/v1/admin/payments/", adminPaymentHandler)
	// Pro grant/revoke for testing; account CRUD routes stay more specific in the admin handler.
	proService := proapplication.New(prodata.New(db))
	adminFeatures.Handle("/v1/admin/users/", protransport.NewAdmin(proService))
	routes.Handle("/v1/admin/", admintransport.New(authService, adminapplication.New(admindata.New(db)), browser, adminFeatures))
	publicLeagues := leaguetransport.New(authService, leagueService)
	routes.Handle("/v1/leagues", publicLeagues)
	routes.Handle("/v1/leagues/", publicLeagues)
	teamService := teamsapplication.New(teamsdata.New(db))
	teamHandler := teamstransport.New(authService, teamService)
	listingHandler := listingtransport.New(authService, listingapplication.New(listingdata.New(db), teamService))
	routes.Handle("/v1/listings", listingHandler)
	routes.Handle("/v1/listings/", listingHandler)
	routes.Handle("/v1/me/listings", listingHandler)
	routes.Handle("/v1/me/listings/", listingHandler)
	tournamentHandler := tournamenttransport.New(authService, tournamentapplication.New(tournamentdata.New(db)))
	for _, path := range []string{"/v1/tournaments", "/v1/tournaments/", "/v1/me/tournaments", "/v1/me/tournaments/", "/v1/me/tournament-entries", "/v1/me/tournament-entries/"} {
		routes.Handle(path, tournamentHandler)
	}
	routes.Handle("/v1/teams", teamHandler)
	routes.Handle("/v1/teams/", teamHandler)
	routes.Handle("/v1/me/team-join-requests", teamHandler)
	contentHandler := contenttransport.New(authService, contentService)
	routes.Handle("/v1/content/", contentHandler)
	routes.Handle("/v1/me/club-news", contentHandler)
	clubHandler := clubtransport.New(authService, clubapplication.New(clubdata.New(db), leagueService))
	routes.Handle("/v1/me/club-profile", clubHandler)
	connectionHandler := connectiontransport.New(authService, connectionapplication.New(connectiondata.New(db)))
	routes.Handle("/v1/connections", connectionHandler)
	routes.Handle("/v1/connections/", connectionHandler)
	routes.Handle("/v1/me/club-center", clubHandler)
	routes.Handle("/v1/me/squad", clubHandler)
	routes.Handle("/v1/me/squad/", clubHandler)
	routes.Handle("/v1/me/memberships", clubHandler)
	routes.Handle("/v1/me/memberships/", clubHandler)
	publicPayments := paymenttransport.NewPublic(authService, paymentService, paymentAdapterSecret)
	routes.Handle("/v1/payments/", publicPayments)
	routes.Handle("/v1/me/team-request-payments", publicPayments)
	routes.Handle("/v1/me/pro-payments", publicPayments)
	moderationHandler := moderationtransport.New(authService, moderationService)
	routes.Handle("/v1/reports", moderationHandler)
	routes.Handle("/v1/me/blocks", moderationHandler)
	routes.Handle("/v1/me/blocks/", moderationHandler)
	routes.Handle("/v1/me/store-orders", publicPayments)
	routes.Handle("/v1/me/store-purchases", publicPayments)
	proHandler := protransport.New(authService, proService)
	routes.Handle("/v1/me/pro", proHandler)
	routes.Handle("/v1/me/pro/", proHandler)
	routes.Handle("/v1/players/", playertransport.New(authService, playerapplication.New(playerRepo), playerapplication.NewMedia(playerRepo)))
	discoveryHandler := discoverytransport.New(authService, discoveryapplication.New(discoverydata.New(db)))
	routes.Handle("/v1/discovery/", discoveryHandler)
	routes.Handle("/v1/me/", discoveryHandler)
	routes.Handle("/", transport.New(authService))
	var handler http.Handler = routes
	if directory := os.Getenv("ADMIN_FRONTEND_DIR"); directory != "" {
		web, err := adminweb.New(directory)
		if err != nil {
			return err
		}
		combined := http.NewServeMux()
		combined.Handle("/api/", http.StripPrefix("/api", routes))
		combined.Handle("GET /securityadmin", web)
		combined.Handle("GET /securityadmin/", web)
		combined.Handle("/", routes)
		handler = combined
	}
	server := &http.Server{Addr: env("LISTEN_ADDR", ":8080"), Handler: handler, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16384}
	listener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		return fmt.Errorf("server could not listen: %w", err)
	}
	defer listener.Close()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go paymentService.RunGoogleRefundSync(ctx, time.Hour)
	go pushService.Run(ctx, 5*time.Second)
	serveResult := make(chan error, 1)
	go func() {
		serveResult <- server.Serve(listener)
	}()
	slog.Info("Fut Career API ready", "address", listener.Addr())
	select {
	case err = <-serveResult:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
	}
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err = server.Shutdown(shutdown); err != nil {
		return fmt.Errorf("shutdown failed: %w", err)
	}
	return nil
}

// storeVerifiers enables App Store and Google Play purchases when configured.
// Without a store, the app shows that purchases are unavailable there.
func storeVerifiers() (paymentdomain.AppStoreVerifier, paymentdomain.GooglePlayVerifier, error) {
	var apple paymentdomain.AppStoreVerifier
	var google paymentdomain.GooglePlayVerifier
	if bundleID := os.Getenv("APPLE_BUNDLE_ID"); bundleID != "" {
		verifier, err := paymentdata.NewAppStore(bundleID)
		if err != nil {
			return nil, nil, err
		}
		apple = verifier
	}
	packageName, account := os.Getenv("GOOGLE_PLAY_PACKAGE_NAME"), os.Getenv("GOOGLE_PLAY_SERVICE_ACCOUNT_FILE")
	if packageName != "" || account != "" {
		if packageName == "" || account == "" {
			return nil, nil, errors.New("GOOGLE_PLAY_PACKAGE_NAME and GOOGLE_PLAY_SERVICE_ACCOUNT_FILE must be configured together")
		}
		verifier, err := paymentdata.NewGooglePlay(packageName, account)
		if err != nil {
			return nil, nil, err
		}
		google = verifier
	}
	return apple, google, nil
}

// pushSender enables Firebase Cloud Messaging when a service account is set;
// otherwise notifications stay in the in-app centre only.
func pushSender() (notificationsdomain.PushSender, error) {
	file := os.Getenv("FIREBASE_SERVICE_ACCOUNT_FILE")
	if file == "" {
		return nil, nil
	}
	sender, err := notificationsdata.NewFCM(file)
	if err != nil {
		return nil, err
	}
	return sender, nil
}
