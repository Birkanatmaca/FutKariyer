package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strconv"
	"syscall"
	"time"

	accountapplication "futcareer/backend/internal/account/application"
	accountdata "futcareer/backend/internal/account/data"
	accounttransport "futcareer/backend/internal/account/transport"
	adminapplication "futcareer/backend/internal/admin/application"
	admindata "futcareer/backend/internal/admin/data"
	admintransport "futcareer/backend/internal/admin/transport"
	"futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/auth/data"
	"futcareer/backend/internal/auth/transport"
	clubapplication "futcareer/backend/internal/clubs/application"
	clubdata "futcareer/backend/internal/clubs/data"
	clubtransport "futcareer/backend/internal/clubs/transport"
	coachapplication "futcareer/backend/internal/coaches/application"
	coachdata "futcareer/backend/internal/coaches/data"
	coachtransport "futcareer/backend/internal/coaches/transport"
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
	"futcareer/backend/internal/platform/audit"
	"futcareer/backend/internal/platform/logging"
	platformmail "futcareer/backend/internal/platform/mail"
	"futcareer/backend/internal/platform/metrics"
	"futcareer/backend/internal/platform/postgres"
	"futcareer/backend/internal/platform/secretbox"
	playerapplication "futcareer/backend/internal/players/application"
	playerdata "futcareer/backend/internal/players/data"
	playertransport "futcareer/backend/internal/players/transport"
	proapplication "futcareer/backend/internal/pro/application"
	prodata "futcareer/backend/internal/pro/data"
	protransport "futcareer/backend/internal/pro/transport"
	ratingapplication "futcareer/backend/internal/rating/application"
	ratingdata "futcareer/backend/internal/rating/data"
	ratingtransport "futcareer/backend/internal/rating/transport"
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

// version is set at build time: -ldflags "-X main.version=1.4.0+4491027".
var version = "dev"

func main() {
	logging.Setup("api", env("APP_ENV", "development"), version, env("LOG_LEVEL", "info"))
	if err := run(); err != nil {
		slog.Error(logging.EventStop, "error", err)
		os.Exit(1)
	}
}

// configWarning flags a setting that is not ready for production.
func configWarning(detail string) { slog.Warn("system.config", "detail", detail) }

func run() error {
	allowInsecureAdmin := os.Getenv("ADMIN_ALLOW_INSECURE_HTTP") == "true"
	if allowInsecureAdmin {
		configWarning("admin panel allows plain HTTP; sessions and passwords travel unencrypted until HTTPS is configured")
	}
	registry := metrics.New()
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
	maxConns, _ := strconv.Atoi(os.Getenv("DB_MAX_CONNS"))
	db, err := postgres.Open(startup, os.Getenv("DATABASE_URL"), postgres.Options{
		MaxConns: maxConns,
		ObserveQuery: func(d time.Duration) {
			registry.Observe("db_query_duration_seconds", "Database statement latency.", metrics.LatencyBuckets, nil, nil, d.Seconds())
		},
	})
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
	sender, err := platformmail.FromEnv(os.Getenv("MAIL_PROVIDER"), os.Getenv("MAIL_API_KEY"), os.Getenv("MAIL_FROM"))
	if err != nil {
		return err
	}
	authService := application.New(repo, ttl)
	if sender != nil {
		authService.WithMailer(sender)
	} else {
		configWarning("email sending is off (MAIL_PROVIDER unset): no email verification or password reset")
	}
	if key := os.Getenv("ADMIN_TOTP_KEY"); key != "" {
		box, err := secretbox.FromKey(key)
		if err != nil {
			return fmt.Errorf("ADMIN_TOTP_KEY: %w", err)
		}
		authService.WithAdminSecondFactor(box)
	} else {
		configWarning("admin two-factor sign-in is off (ADMIN_TOTP_KEY unset); set it before going live")
	}
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
	accountHandler := accounttransport.New(authService, accountapplication.New(accountdata.New(db)))
	routes.Handle("/v1/me/profile", accountHandler)
	routes.Handle("/v1/me/avatar", accountHandler)
	routes.Handle("/v1/users/{id}/avatar", accountHandler)
	ratingService := ratingapplication.New(ratingdata.New(db))
	ratingHandler := ratingtransport.New(authService, ratingService)
	routes.Handle("/v1/rating", ratingHandler)
	routes.Handle("/v1/rating/", ratingHandler)
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
	adminFeatures.Handle("/v1/admin/rating/", ratingtransport.NewAdmin(ratingService))
	applicationAdmin := registrationtransport.NewAdmin(registrationdata.New(db))
	adminFeatures.Handle("/v1/admin/applications", applicationAdmin)
	adminFeatures.Handle("/v1/admin/applications/", applicationAdmin)
	adminFeatures.Handle("/v1/admin/club-overviews/", clubtransport.NewAdmin(clubapplication.New(clubdata.New(db), leagueService, footballService)))
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
	clubHandler := clubtransport.New(authService, clubapplication.New(clubdata.New(db), leagueService, footballService))
	routes.Handle("/v1/me/club-profile", clubHandler)
	routes.Handle("/v1/me/club-profile/tff", clubHandler)
	connectionHandler := connectiontransport.New(authService, connectionapplication.New(connectiondata.New(db)))
	routes.Handle("/v1/connections", connectionHandler)
	routes.Handle("/v1/connections/", connectionHandler)
	routes.Handle("/v1/me/club-center", clubHandler)
	routes.Handle("/v1/me/club-leagues", clubHandler)
	routes.Handle("/v1/me/coach-team", clubHandler)
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
	coachHandler := coachtransport.New(authService, coachapplication.New(coachdata.New(db)))
	for _, path := range []string{"/v1/me/coach-profile", "/v1/me/staff", "/v1/me/staff/", "/v1/me/coach-clubs", "/v1/me/coach-clubs/", "/v1/staff/"} {
		routes.Handle(path, coachHandler)
	}
	discoveryHandler := discoverytransport.New(authService, discoveryapplication.New(discoverydata.New(db)))
	routes.Handle("/v1/discovery/", discoveryHandler)
	routes.Handle("/v1/me/", discoveryHandler)
	// /health: the process answers. /ready: it can serve (database reachable,
	// schema current); the container healthcheck and uptime checks use it.
	routes.HandleFunc("GET /ready", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		if err := db.PingContext(ctx); err != nil {
			logging.Warn(w, "system.not_ready", err, "check", "database")
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"status":"database_unavailable"}`))
			return
		}
		if err := migrations.CheckCurrent(ctx, db); err != nil {
			logging.Warn(w, "system.not_ready", err, "check", "migrations")
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"status":"migrations_pending"}`))
			return
		}
		_, _ = w.Write([]byte(`{"status":"ready"}`))
	})
	routes.Handle("POST /v1/client-errors", logging.ClientErrors(func(source string, fatal bool) {
		registry.Add("client_errors_total", "Errors reported by the apps.", []string{"source", "fatal"}, []string{source, strconv.FormatBool(fatal)}, 1)
	}))
	authHandler := transport.New(authService)
	for _, path := range []string{"/v1/me/password", "/v1/me/sessions", "/v1/me/sessions/"} {
		routes.Handle(path, authHandler)
	}
	routes.Handle("/", authHandler)
	// Switched (coach-as-club) sessions only reach what the club allowed.
	guarded := transport.DelegationGuard(authService, transport.VerifiedGuard(authService, routes))
	var handler http.Handler = guarded
	if directory := os.Getenv("ADMIN_FRONTEND_DIR"); directory != "" {
		web, err := adminweb.New(directory)
		if err != nil {
			return err
		}
		combined := http.NewServeMux()
		combined.Handle("/api/", http.StripPrefix("/api", guarded))
		combined.Handle("GET /securityadmin", web)
		combined.Handle("GET /securityadmin/", web)
		combined.Handle("/", guarded)
		handler = combined
	}
	handler = audit.Middleware(handler)
	handler = logging.Middleware(handler, registry.ObserveRequest)
	registerGauges(registry, db)
	server := &http.Server{Addr: env("LISTEN_ADDR", ":8080"), Handler: handler, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16384}
	listener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		return fmt.Errorf("server could not listen: %w", err)
	}
	defer listener.Close()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	logging.Go(ctx, "payment.refund_sync", func(ctx context.Context) { paymentService.RunGoogleRefundSync(ctx, time.Hour) })
	logging.Go(ctx, "push.dispatch", func(ctx context.Context) { pushService.Run(ctx, 5*time.Second) })
	if addr := os.Getenv("METRICS_ADDR"); addr != "" {
		// Never published: Prometheus or the collector reads it from inside.
		metricsServer := &http.Server{Addr: addr, Handler: registry.Handler(), ReadHeaderTimeout: 5 * time.Second}
		go func() {
			if err := metricsServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				slog.Error("system.metrics.failed", "error", err)
			}
		}()
		defer metricsServer.Close()
	}
	serveResult := make(chan error, 1)
	go func() {
		serveResult <- server.Serve(listener)
	}()
	slog.Info(logging.EventStart, "address", listener.Addr().String())
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

// registerGauges exposes the connection pool, the Go runtime and the build.
func registerGauges(r *metrics.Registry, db *sql.DB) {
	started := time.Now()
	r.Gauge("db_pool_connections", "Database connections by state.", func() []metrics.Sample {
		s := db.Stats()
		return []metrics.Sample{
			{Labels: []string{"state", "in_use"}, Value: float64(s.InUse)},
			{Labels: []string{"state", "idle"}, Value: float64(s.Idle)},
			{Labels: []string{"state", "max"}, Value: float64(s.MaxOpenConnections)},
		}
	})
	r.Gauge("db_pool_wait_total", "Times a request waited for a free connection.", func() []metrics.Sample {
		return []metrics.Sample{{Value: float64(db.Stats().WaitCount)}}
	})
	r.Gauge("db_pool_wait_seconds_total", "Total time spent waiting for a connection.", func() []metrics.Sample {
		return []metrics.Sample{{Value: db.Stats().WaitDuration.Seconds()}}
	})
	r.Gauge("go_goroutines", "Goroutines.", func() []metrics.Sample {
		return []metrics.Sample{{Value: float64(runtime.NumGoroutine())}}
	})
	r.Gauge("go_memory_bytes", "Go heap in use and memory obtained from the OS.", func() []metrics.Sample {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		return []metrics.Sample{{Labels: []string{"kind", "heap"}, Value: float64(m.HeapAlloc)}, {Labels: []string{"kind", "sys"}, Value: float64(m.Sys)}}
	})
	r.Gauge("process_uptime_seconds", "Seconds since the API started.", func() []metrics.Sample {
		return []metrics.Sample{{Value: time.Since(started).Seconds()}}
	})
	r.Gauge("build_info", "The running version.", func() []metrics.Sample {
		return []metrics.Sample{{Labels: []string{"version", version}, Value: 1}}
	})
}
