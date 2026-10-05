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

	"futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/auth/data"
	"futcareer/backend/internal/auth/transport"
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
	ttl, err := time.ParseDuration(env("SESSION_TTL", "720h"))
	if err != nil || ttl <= 0 {
		return errors.New("SESSION_TTL must be a positive duration")
	}
	repo, err := data.Open(env("DATABASE_PATH", "./data/futcareer.db"))
	if err != nil {
		return fmt.Errorf("database could not be opened: %w", err)
	}
	defer repo.Close()
	server := &http.Server{Addr: env("LISTEN_ADDR", ":8080"), Handler: transport.New(application.New(repo, ttl)), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16384}
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
