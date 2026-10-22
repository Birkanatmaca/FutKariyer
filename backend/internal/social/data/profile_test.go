package data_test

import (
	"context"
	"errors"
	"testing"

	"futcareer/backend/internal/social/data"
	"futcareer/backend/internal/social/domain"
	"futcareer/backend/internal/testsupport/testpostgres"
)

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestProfileOpensFromAnyPostAndRecordsTheVisit(t *testing.T) {
	db := testpostgres.New(t)
	ctx := context.Background()
	const (
		player  = "00000000000000000000000000000b01" // not discoverable
		club    = "00000000000000000000000000000b02" // verified
		other   = "00000000000000000000000000000b03" // another club
		blocker = "00000000000000000000000000000b04"
	)
	for _, u := range []struct{ id, role string }{{player, "player"}, {club, "club"}, {other, "club"}, {blocker, "player"}} {
		email := any(u.id + "@example.test")
		var username any
		if u.role == "club" {
			email, username = nil, "u"+u.id[24:]
		}
		if _, err := db.DB.ExecContext(ctx, `INSERT INTO users(id,full_name,email,username,password_hash,role,city,created_at,verified) VALUES($1,$1,$2,$3,'unused',$4,'Ankara',now(),$4='club')`, u.id, email, username, u.role); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.DB.ExecContext(ctx, `INSERT INTO player_profiles(user_id,availability,discoverable,football_type,updated_at) VALUES($1,'seeking_team',false,'halisaha',now())`, player); err != nil {
		t.Fatal(err)
	}
	if _, err := db.DB.ExecContext(ctx, `INSERT INTO clubs(user_id,football_type,updated_at) VALUES($1,'halisaha',now()),($2,'amateur',now())`, club, other); err != nil {
		t.Fatal(err)
	}
	if _, err := db.DB.ExecContext(ctx, `INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, blocker, club); err != nil {
		t.Fatal(err)
	}
	repo := data.New(db.DB)
	if _, err := repo.CreatePost(ctx, player, "cccccccccccccccccccccccccccccccc", "Maç günü", nil); err != nil {
		t.Fatal(err)
	}
	if err := repo.SetFollow(ctx, club, player, true); err != nil {
		t.Fatal(err)
	}

	// A club opens a player who is hidden from discovery: the social profile
	// opens, football details stay hidden and discovery stays closed.
	p, err := repo.Profile(ctx, club, player)
	if err != nil || p.Role != "player" || p.Posts != 1 || p.Followers != 1 || !p.Author.Following || p.Self || p.Discovery || p.FootballType != "unknown" {
		t.Fatalf("player profile: %+v %v", p, err)
	}
	// A club opens another club (discovery never allows this) and the visit counts.
	if p, err = repo.Profile(ctx, club, other); err != nil || p.Discovery || p.Role != "club" || p.FootballType != "amateur" {
		t.Fatalf("club profile: %+v %v", p, err)
	}
	if _, err = repo.Profile(ctx, club, other); err != nil {
		t.Fatal(err)
	}
	var views int
	if err := db.DB.QueryRow(`SELECT count(*) FROM profile_views WHERE viewer_id=$1`, club).Scan(&views); err != nil || views != 2 {
		t.Fatalf("one view per profile and day expected, got %d %v", views, err)
	}
	// A player may open a verified club's discovery profile too.
	if p, err = repo.Profile(ctx, player, club); err != nil || !p.Discovery || p.FollowingCount != 1 {
		t.Fatalf("club seen by a player: %+v %v", p, err)
	}
	// Own profile: no view recorded.
	if p, err = repo.Profile(ctx, player, player); err != nil || !p.Self {
		t.Fatalf("self: %+v %v", p, err)
	}
	if err := db.DB.QueryRow(`SELECT count(*) FROM profile_views WHERE profile_id=viewer_id`).Scan(&views); err != nil || views != 0 {
		t.Fatalf("self view recorded: %d", views)
	}
	// Blocks close the profile both ways and record nothing.
	if _, err = repo.Profile(ctx, club, blocker); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("blocked profile opened: %v", err)
	}
	if _, err = repo.Profile(ctx, blocker, club); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("blocker opened the club: %v", err)
	}
	if err := db.DB.QueryRow(`SELECT count(*) FROM profile_views WHERE viewer_id=$1 OR profile_id=$1`, blocker).Scan(&views); err != nil || views != 0 {
		t.Fatalf("blocked visit recorded: %d", views)
	}
}
