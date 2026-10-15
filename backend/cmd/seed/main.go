// Command seed installs or removes the optional demo environment. Demo data is
// deliberately not a migration: it is added and removed on demand.
//
//	seed demo                       install (replaces earlier demo data, new password)
//	seed demo --follow-email a@b.c  also make demo players interact with an existing account
//	seed demo --remove              delete every demo account and related row
//	seed demo --status              print the demo rows currently present
//
// Credentials go to stdout only; progress and errors go to stderr.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"time"

	"futcareer/backend/internal/demo/application"
	"futcareer/backend/internal/demo/data"
	"futcareer/backend/internal/demo/domain"
	"futcareer/backend/internal/platform/postgres"
	"futcareer/backend/migrations"
)

func main() {
	if err := run(os.Args[1:], os.Stdout, os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, "seed:", err)
		os.Exit(1)
	}
}

func usage(w io.Writer) {
	fmt.Fprintln(w, "kullanım: seed demo [--follow-email e-posta] | seed demo --remove | seed demo --status")
}

func run(args []string, stdout, stderr io.Writer) error {
	if len(args) == 0 || args[0] != "demo" {
		usage(stderr)
		return errors.New("bilinmeyen komut")
	}
	flags := flag.NewFlagSet("demo", flag.ContinueOnError)
	flags.SetOutput(stderr)
	remove := flags.Bool("remove", false, "demo hesaplarını ve ilişkili tüm kayıtları sil")
	status := flags.Bool("status", false, "mevcut demo kayıt sayılarını yazdır")
	followEmail := flags.String("follow-email", "", "demo oyuncularının takip edip tanışma isteği göndereceği mevcut hesap")
	if err := flags.Parse(args[1:]); err != nil {
		return err
	}
	if flags.NArg() > 0 || (*remove && (*status || *followEmail != "")) || (*status && *followEmail != "") {
		usage(stderr)
		return errors.New("geçersiz bayrak birleşimi")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	db, err := postgres.Open(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer db.Close()
	if err = migrations.CheckCurrent(ctx, db); err != nil {
		return err
	}
	service := application.New(data.New(db))
	switch {
	case *remove:
		n, err := service.Remove(ctx)
		if err != nil {
			return err
		}
		fmt.Fprintf(stderr, "Demo verisi kaldırıldı: %d hesap ve ilişkili kayıtlar silindi.\n", n)
		return nil
	case *status:
		counts, err := service.Counts(ctx)
		if err != nil {
			return err
		}
		printCounts(stdout, counts)
		return nil
	}
	result, err := service.Install(ctx, *followEmail)
	if errors.Is(err, domain.ErrFollowTarget) {
		return fmt.Errorf("--follow-email: %w", err)
	}
	if err != nil {
		return err
	}
	fmt.Fprintln(stderr, "Demo verisi kuruldu (önceki demo verisi varsa silinip yeniden oluşturuldu).")
	printCounts(stderr, result.Counts)
	if *followEmail != "" {
		f := result.Follow
		fmt.Fprintf(stderr, "%s (%s): %d takipçi, %d beğeni, %d profil ziyaretçisi, %d bekleyen tanışma isteği ve bildirimi eklendi.\n", f.Name, f.Role, f.Follows, f.Likes, f.Visits, f.Connections)
	}
	printCredentials(stdout, result)
	return nil
}

func printCounts(w io.Writer, c domain.Counts) {
	rows := []struct {
		label string
		n     int
	}{
		{"Sporcu", c.Players}, {"Etkin kulüp", c.ActiveClubs}, {"Etkin organizasyon", c.Organizers},
		{"Bekleyen başvuru", c.PendingApplications}, {"Reddedilen başvuru", c.RejectedApplications},
		{"Gönderi", c.Posts}, {"Beğeni", c.Likes}, {"Yanıt", c.Replies}, {"Takip", c.Follows}, {"Profil görüntüleme", c.ProfileViews},
		{"Açık ilan", c.Listings}, {"Takım başvurusu (bekleyen)", c.JoinPending}, {"Takım başvurusu (kabul)", c.JoinAccepted},
		{"Takım başvurusu (ret)", c.JoinRejected}, {"Kadro üyesi", c.SquadMembers}, {"Tanışma isteği", c.Connections},
		{"Yayındaki kulüp haberi", c.NewsPublished}, {"Onay bekleyen kulüp haberi", c.NewsPending},
		{"Lig takımı", c.LeagueTeams}, {"Oynanmış maç", c.MatchesPlayed}, {"Planlanmış maç", c.MatchesScheduled},
		{"Turnuva", c.Tournaments}, {"Turnuva başvurusu", c.TournamentEntries}, {"Bildirim", c.Notifications},
	}
	for _, r := range rows {
		fmt.Fprintf(w, "%-28s %d\n", r.label, r.n)
	}
}

func printCredentials(w io.Writer, r application.Result) {
	fmt.Fprintln(w, "# Fut Career demo girişleri — bu çıktıyı yalnızca root'un okuyabildiği bir dosyada sakla.")
	fmt.Fprintln(w, "# Tüm demo hesaplarının şifresi aynıdır ve her çalıştırmada yenilenir.")
	fmt.Fprintf(w, "password: %s\n", r.Password)
	for _, a := range r.Accounts {
		state := "aktif"
		switch a.ApprovalStatus {
		case "pending":
			state = "onay bekliyor (giriş yapamaz)"
		case "rejected":
			state = "reddedildi (giriş yapamaz)"
		}
		fmt.Fprintf(w, "%-10s %-48s %s — %s\n", a.Role, a.Login(), a.FullName, state)
	}
}
