package data_test

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"
	"time"

	auth "futcareer/backend/internal/auth/application"
	authdata "futcareer/backend/internal/auth/data"
	authdomain "futcareer/backend/internal/auth/domain"
	contentdata "futcareer/backend/internal/content/data"
	"futcareer/backend/internal/demo/application"
	"futcareer/backend/internal/demo/data"
	"futcareer/backend/internal/demo/domain"
	leaguesdata "futcareer/backend/internal/leagues/data"
	registrations "futcareer/backend/internal/registrations/data"
	"futcareer/backend/internal/testsupport/testpostgres"
)

// A Thursday afternoon in Istanbul, like the day this tool was written.
var clock = time.Date(2026, 10, 15, 12, 30, 0, 0, time.UTC)

type realData struct {
	player, other, club string
}

// seedReal creates non-demo accounts with activity that removal must not touch.
func seedReal(t *testing.T, ctx context.Context, db *sql.DB) realData {
	t.Helper()
	svc := auth.New(authdata.New(db), time.Hour)
	var out realData
	for i, email := range []string{"gercek.oyuncu@example.com", "diger.oyuncu@example.com"} {
		res, err := svc.Register(ctx, auth.RegisterInput{FullName: []string{"Gerçek Oyuncu", "Diğer Oyuncu"}[i], Email: email, Password: "guclu-sifre-123", Role: "player", FootballType: "amateur", LicenseStatus: "licensed"})
		if err != nil {
			t.Fatal(err)
		}
		if i == 0 {
			out.player = res.User.ID
		} else {
			out.other = res.User.ID
		}
	}
	out.club = "c0ffee00c0ffee00c0ffee00c0ffee00"
	mustExec(t, db, `INSERT INTO users(id,full_name,username,password_hash,role,city,active,verified,created_at) VALUES($1,'Gerçek Kulüp','gercekkulup','x','club','Ankara',true,true,now())`, out.club)
	mustExec(t, db, `INSERT INTO clubs(user_id,football_type,district,updated_at) VALUES($1,'amateur','Çankaya',now())`, out.club)
	mustExec(t, db, `INSERT INTO social_posts(id,author_id,body) VALUES('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',$1,'Gerçek gönderi'),('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',$2,'Diğer gönderi')`, out.player, out.other)
	mustExec(t, db, `INSERT INTO profile_follows(profile_id,follower_id) VALUES($1,$2)`, out.player, out.other)
	mustExec(t, db, `INSERT INTO social_likes(post_id,user_id) VALUES('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',$1)`, out.other)
	mustExec(t, db, `INSERT INTO team_join_requests(id,player_id,club_user_id) VALUES('cccccccccccccccccccccccccccccccc',$1,$2)`, out.other, out.club)
	return out
}

func mustExec(t *testing.T, db *sql.DB, query string, args ...any) {
	t.Helper()
	if _, err := db.Exec(query, args...); err != nil {
		t.Fatal(err)
	}
}

func count(t *testing.T, db *sql.DB, query string, args ...any) int {
	t.Helper()
	var n int
	if err := db.QueryRow(query, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func realSnapshot(t *testing.T, db *sql.DB, r realData) [6]int {
	return [6]int{
		count(t, db, `SELECT count(*) FROM users WHERE id IN ($1,$2,$3)`, r.player, r.other, r.club),
		count(t, db, `SELECT count(*) FROM social_posts WHERE author_id IN ($1,$2)`, r.player, r.other),
		count(t, db, `SELECT count(*) FROM profile_follows WHERE profile_id=$1 AND follower_id=$2`, r.player, r.other),
		count(t, db, `SELECT count(*) FROM social_likes WHERE user_id=$1`, r.other),
		count(t, db, `SELECT count(*) FROM team_join_requests WHERE player_id=$1`, r.other),
		count(t, db, `SELECT count(*) FROM player_profiles WHERE user_id IN ($1,$2)`, r.player, r.other),
	}
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestInstallIsIdempotentAndRemovable(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	real := seedReal(t, ctx, db)
	before := realSnapshot(t, db, real)
	svc := application.New(data.New(db)).WithClock(func() time.Time { return clock })
	expected := domain.Build(clock).Expected()

	first, err := svc.Install(ctx, "")
	if err != nil {
		t.Fatal(err)
	}
	if first.Counts != expected {
		t.Fatalf("counts\n got %+v\nwant %+v", first.Counts, expected)
	}
	want := domain.Counts{Players: 18, ActiveClubs: 10, Organizers: 1, PendingApplications: 4, RejectedApplications: 1,
		JoinPending: 6, JoinAccepted: 4, JoinRejected: 3, SquadMembers: 4, Connections: 5, NewsPublished: 4, NewsPending: 1,
		LeagueTeams: 6, MatchesPlayed: 12, MatchesScheduled: 18, Tournaments: 1, TournamentEntries: 2, Listings: 3,
		Coaches: 1, Avatars: 30, PostMedia: 18, GalleryItems: 5, StaffLinks: 1, NewsImages: 5}
	got := first.Counts
	got.Posts, got.Likes, got.Replies, got.Follows, got.ProfileViews, got.Notifications = 0, 0, 0, 0, 0, 0
	if got != want {
		t.Fatalf("fixed counts\n got %+v\nwant %+v", got, want)
	}
	if first.Counts.Posts < 18 || first.Counts.Likes == 0 || first.Counts.Replies == 0 || first.Counts.Notifications == 0 {
		t.Fatalf("social activity missing: %+v", first.Counts)
	}
	for _, a := range first.Accounts {
		people := a.Role == "player" || a.Role == "coach"
		if people && !domain.IsDemoEmail(a.Email) || !people && (!strings.HasPrefix(a.Username, domain.UsernamePrefix) || !domain.IsDemoEmail(a.Email)) {
			t.Fatalf("account not marked as demo: %+v", a)
		}
	}
	// Each player follows 3–8 accounts and has 1–4 posts.
	for _, a := range first.Accounts {
		if a.Role != "player" {
			continue
		}
		if n := count(t, db, `SELECT count(*) FROM profile_follows WHERE follower_id=$1`, a.ID); n < 3 || n > 8 {
			t.Fatalf("%s follows %d accounts", a.Key, n)
		}
		if n := count(t, db, `SELECT count(*) FROM social_posts WHERE author_id=$1`, a.ID); n < 1 || n > 4 {
			t.Fatalf("%s has %d posts", a.Key, n)
		}
	}
	if n := count(t, db, `SELECT count(*) FROM social_posts WHERE author_id NOT IN ($3,$4) AND (created_at >= $1 OR created_at < $2)`, clock, clock.AddDate(0, 0, -22), real.player, real.other); n != 0 {
		t.Fatalf("demo posts outside the last three weeks: %d", n)
	}

	// The shared password signs demo players and active clubs in; pending applicants stay out.
	authSvc := auth.New(authdata.New(db), time.Hour)
	if _, err := authSvc.Login(ctx, auth.LoginInput{Identifier: "emre.kaya@" + domain.EmailDomain, Password: first.Password}); err != nil {
		t.Fatalf("demo player login: %v", err)
	}
	if res, err := authSvc.Login(ctx, auth.LoginInput{Identifier: "demo.barisspor", Password: first.Password}); err != nil || !res.User.Verified {
		t.Fatalf("demo club login: %+v %v", res.User, err)
	}
	if _, err := authSvc.Login(ctx, auth.LoginInput{Identifier: "demo.gerede.onderspor", Password: first.Password}); !errors.Is(err, authdomain.ErrPendingApproval) {
		t.Fatalf("pending demo club signed in: %v", err)
	}
	// The demo coach signs in, has a filled-in profile and runs Barışspor's staff.
	if res, err := authSvc.Login(ctx, auth.LoginInput{Identifier: "selim.kara@" + domain.EmailDomain, Password: first.Password}); err != nil || res.User.Role != "coach" || !res.User.Verified {
		t.Fatalf("demo coach login: %+v %v", res.User, err)
	}
	if n := count(t, db, `SELECT count(*) FROM coach_profiles WHERE user_id=$1 AND license_level='uefa_b' AND cardinality(past_clubs)=2 AND show_license`, domain.UserID("selim")); n != 1 {
		t.Fatalf("demo coach profile missing")
	}
	if n := count(t, db, `SELECT count(*) FROM club_staff WHERE club_user_id=$1 AND coach_user_id=$2 AND status='active' AND 'squad'=ANY(permissions)`, domain.UserID("barisspor"), domain.UserID("selim")); n != 1 {
		t.Fatalf("demo coach is not on the club's staff")
	}
	// Every active demo account has a picture the app will show.
	if n := count(t, db, `SELECT count(*) FROM users u JOIN user_avatars a ON a.user_id=u.id WHERE lower(u.email) LIKE '%' || $1 AND u.active AND u.avatar_version=1`, domain.EmailSuffix); n != 30 {
		t.Fatalf("demo avatars: %d", n)
	}
	if n := count(t, db, `SELECT count(*) FROM social_posts WHERE media_kind='image' AND show_on_profile AND author_id=$1`, domain.UserID("zeynep")); n != 2 {
		t.Fatalf("zeynep's post photos on her profile: %d", n)
	}
	if n := count(t, db, `SELECT count(*) FROM news_articles WHERE image_id IS NOT NULL AND author_user_id=$1`, domain.UserID("barisspor")); n != 1 {
		t.Fatalf("news cover missing")
	}

	// The admin queues show the demo applications and the pending club article.
	queue := registrations.New(db)
	pending, err := queue.List(ctx, "pending")
	if err != nil || len(pending) != 4 {
		t.Fatalf("pending applications: %d %v", len(pending), err)
	}
	roles := map[string]int{}
	for _, a := range pending {
		roles[a.Role]++
	}
	if roles["club"] != 3 || roles["organizer"] != 1 {
		t.Fatalf("pending roles: %v", roles)
	}
	rejected, err := queue.List(ctx, "rejected")
	if err != nil || len(rejected) != 1 || rejected[0].RejectionReason == "" || rejected[0].DecidedAt == nil {
		t.Fatalf("rejected applications: %+v %v", rejected, err)
	}
	articles, err := contentdata.New(db).PendingClubArticles(ctx)
	if err != nil || len(articles) != 1 {
		t.Fatalf("pending club articles: %d %v", len(articles), err)
	}

	// Standings come from the seeded matches.
	detail, err := leaguesdata.New(db).Get(ctx, domain.LeagueID, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(detail.Standings) != 6 || detail.Statistics.PlayedMatches != 12 || detail.Statistics.ScheduledMatches != 18 {
		t.Fatalf("league: %d standings, %+v", len(detail.Standings), detail.Statistics)
	}
	points := map[string]int{}
	goals := 0
	ds := domain.Build(clock)
	club := map[string]string{}
	for _, team := range ds.League.Teams {
		club[team.ID] = team.ClubID
	}
	for _, m := range ds.League.Matches {
		if m.HomeGoals == nil {
			continue
		}
		h, a := *m.HomeGoals, *m.AwayGoals
		goals += h + a
		switch {
		case h > a:
			points[club[m.HomeTeamID]] += 3
		case h < a:
			points[club[m.AwayTeamID]] += 3
		default:
			points[club[m.HomeTeamID]]++
			points[club[m.AwayTeamID]]++
		}
	}
	for i, s := range detail.Standings {
		if s.Played != 4 || s.Points != points[s.ClubID] || (i > 0 && s.Points > detail.Standings[i-1].Points) {
			t.Fatalf("standing %+v, want %d points", s, points[s.ClubID])
		}
	}
	if detail.Statistics.TotalGoals != goals {
		t.Fatalf("total goals %d, want %d", detail.Statistics.TotalGoals, goals)
	}

	// A second run replaces the data: same rows, new password.
	users := count(t, db, `SELECT count(*) FROM users`)
	second, err := svc.Install(ctx, "")
	if err != nil {
		t.Fatal(err)
	}
	if second.Counts != expected || count(t, db, `SELECT count(*) FROM users`) != users || second.Password == first.Password {
		t.Fatalf("second install differs: %+v", second.Counts)
	}
	if _, err := authSvc.Login(ctx, auth.LoginInput{Identifier: "emre.kaya@" + domain.EmailDomain, Password: first.Password}); !errors.Is(err, authdomain.ErrUnauthorized) {
		t.Fatalf("old password still works: %v", err)
	}

	// A real player's application to a demo club goes with the club.
	mustExec(t, db, `INSERT INTO team_join_requests(id,player_id,club_user_id) VALUES('dddddddddddddddddddddddddddddddd',$1,$2)`, real.player, domain.UserID("ulubeyspor"))
	mustExec(t, db, `INSERT INTO profile_follows(profile_id,follower_id) VALUES($1,$2)`, domain.UserID("ulubeyspor"), real.player)

	removed, err := svc.Remove(ctx)
	if err != nil || removed != len(ds.Accounts) {
		t.Fatalf("removed %d accounts: %v", removed, err)
	}
	after, err := svc.Counts(ctx)
	if err != nil || after != (domain.Counts{}) {
		t.Fatalf("demo rows left: %+v %v", after, err)
	}
	if n := count(t, db, `SELECT count(*) FROM team_join_requests WHERE player_id=$1`, real.player); n != 0 {
		t.Fatalf("request to a removed demo club kept: %d", n)
	}
	if n := count(t, db, `SELECT count(*) FROM leagues`) + count(t, db, `SELECT count(*) FROM notifications`) + count(t, db, `SELECT count(*) FROM tournaments`); n != 0 {
		t.Fatalf("demo league, tournament or notifications left: %d", n)
	}
	if got := realSnapshot(t, db, real); got != before {
		t.Fatalf("real rows changed: %v, want %v", got, before)
	}
	if _, err := svc.Remove(ctx); err != nil {
		t.Fatalf("removing twice: %v", err)
	}
}

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestFollowEmailOnlyTouchesTheNamedAccount(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	real := seedReal(t, ctx, db)
	svc := application.New(data.New(db)).WithClock(func() time.Time { return clock })

	for _, email := range []string{"yok@example.com", "emre.kaya@" + domain.EmailDomain} {
		if _, err := svc.Install(ctx, email); !errors.Is(err, domain.ErrFollowTarget) {
			t.Fatalf("follow target %s accepted: %v", email, err)
		}
	}
	if c, _ := svc.Counts(ctx); c != (domain.Counts{}) {
		t.Fatalf("failed install left rows: %+v", c)
	}

	res, err := svc.Install(ctx, " Gercek.Oyuncu@example.com ")
	if err != nil {
		t.Fatal(err)
	}
	if res.Follow.Follows != 6 || res.Follow.Connections != 2 || res.Follow.Likes != 3 || res.Follow.Role != "player" {
		t.Fatalf("follow result: %+v", res.Follow)
	}
	demoFollowers := `SELECT count(*) FROM profile_follows WHERE profile_id=$1 AND follower_id IN (SELECT id FROM users WHERE email LIKE '%@` + domain.EmailDomain + `')`
	if count(t, db, demoFollowers, real.player) != 6 || count(t, db, demoFollowers, real.other) != 0 || count(t, db, demoFollowers, real.club) != 0 {
		t.Fatal("demo follows reached the wrong account")
	}
	if n := count(t, db, `SELECT count(*) FROM connection_requests WHERE recipient_id=$1 AND status='pending'`, real.player); n != 2 {
		t.Fatalf("pending connection requests to target: %d", n)
	}
	if n := count(t, db, `SELECT count(*) FROM notifications WHERE recipient_id=$1 AND kind='connection' AND read_at IS NULL`, real.player); n != 2 {
		t.Fatalf("target notifications: %d", n)
	}
	if n := count(t, db, `SELECT count(*) FROM notifications WHERE recipient_id IN ($1,$2)`, real.other, real.club); n != 0 {
		t.Fatalf("other real accounts notified: %d", n)
	}
	if n := count(t, db, `SELECT count(*) FROM social_likes WHERE post_id='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'`); n != 4 {
		t.Fatalf("likes on target post: %d (1 real + 3 demo)", n)
	}
	if n := count(t, db, `SELECT count(*) FROM social_likes WHERE post_id='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'`); n != 0 {
		t.Fatalf("likes on another account's post: %d", n)
	}

	if _, err := svc.Remove(ctx); err != nil {
		t.Fatal(err)
	}
	if count(t, db, demoFollowers, real.player) != 0 || count(t, db, `SELECT count(*) FROM notifications`) != 0 || count(t, db, `SELECT count(*) FROM connection_requests`) != 0 {
		t.Fatal("follow-email activity survived removal")
	}
	if n := count(t, db, `SELECT count(*) FROM social_likes WHERE post_id='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'`); n != 1 {
		t.Fatalf("real like removed: %d", n)
	}
}
