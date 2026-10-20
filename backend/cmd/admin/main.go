package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"sort"
	"strings"
	"time"

	admin "futcareer/backend/internal/admin/application"
	"futcareer/backend/internal/admin/data"
	auth "futcareer/backend/internal/auth/application"
	authdata "futcareer/backend/internal/auth/data"
	"futcareer/backend/internal/platform/postgres"
	"futcareer/backend/migrations"
)

func main() {
	if err := run(); err != nil {
		slog.Error("initial admin could not be created", "error", err)
		os.Exit(1)
	}
}
func run() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := postgres.Open(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer db.Close()
	if err = migrations.CheckCurrent(ctx, db); err != nil {
		return err
	}
	// "admin reset-2fa <e-posta veya kullanıcı adı>": for an admin who lost
	// both the authenticator and the recovery codes. The next sign-in enrols
	// a new authenticator; current sessions end.
	if len(os.Args) == 3 && os.Args[1] == "reset-2fa" {
		if err = auth.New(authdata.New(db), time.Hour).ResetAdminSecondFactor(ctx, os.Args[2]); err != nil {
			return fmt.Errorf("iki aşamalı doğrulama sıfırlanamadı: %w", err)
		}
		fmt.Println("İki aşamalı doğrulama sıfırlandı; yönetici bir sonraki girişte yeniden kuracak.")
		return nil
	}
	account, err := admin.New(data.New(db)).Bootstrap(ctx, auth.AccountInput{FullName: os.Getenv("ADMIN_FULL_NAME"), Email: os.Getenv("ADMIN_EMAIL"), Username: os.Getenv("ADMIN_USERNAME"), Password: os.Getenv("ADMIN_PASSWORD")})
	if err != nil {
		var fields auth.ValidationError
		if errors.As(err, &fields) {
			messages := make([]string, 0, len(fields))
			for field, message := range fields {
				messages = append(messages, field+": "+message)
			}
			sort.Strings(messages)
			return fmt.Errorf("kurulum bilgilerini kontrol et: %s", strings.Join(messages, "; "))
		}
		return err
	}
	fmt.Printf("Yönetici oluşturuldu: %s\n", account.Username)
	return nil
}
