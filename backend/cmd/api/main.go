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
	"futcareer/backend/internal/platform/adminweb"
	"futcareer/backend/internal/platform/postgres"
	playerapplication "futcareer/backend/internal/players/application"
	playerdata "futcareer/backend/internal/players/data"
	playertransport "futcareer/backend/internal/players/transport"
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
	browser, err := admintransport.BrowserOrigin(env("ADMIN_ORIGIN", "http://localhost:5175"))
	if err != nil {
		return err
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
	routes := http.NewServeMux()
	routes.Handle("/v1/admin/", admintransport.New(authService, adminapplication.New(admindata.New(db)), browser))
	routes.Handle("/v1/players/", playertransport.New(authService, playerapplication.New(playerRepo)))
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
