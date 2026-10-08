package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"futcareer/backend/internal/platform/postgres"
	"futcareer/backend/migrations"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		slog.Error("migration command failed", "error", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) != 1 || (args[0] != "up" && args[0] != "status" && args[0] != "down") {
		return errors.New("usage: go run ./cmd/migrate up|status|down")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	db, err := postgres.Open(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer db.Close()
	provider, err := migrations.NewProvider(db)
	if err != nil {
		return err
	}
	switch args[0] {
	case "up":
		results, err := provider.Up(ctx)
		if err != nil {
			return err
		}
		fmt.Printf("Applied %d migration(s).\n", len(results))
	case "down":
		result, err := provider.Down(ctx)
		if err != nil {
			return err
		}
		fmt.Printf("Rolled back migration %d.\n", result.Source.Version)
	case "status":
		statuses, err := provider.Status(ctx)
		if err != nil {
			return err
		}
		for _, status := range statuses {
			fmt.Printf("%05d  %-8s  %s\n", status.Source.Version, status.State, status.Source.Path)
		}
	}
	return nil
}
