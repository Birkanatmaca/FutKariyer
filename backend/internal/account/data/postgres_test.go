package data_test

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"image"
	"image/png"
	"testing"

	"futcareer/backend/internal/account/application"
	"futcareer/backend/internal/account/data"
	"futcareer/backend/internal/account/domain"
	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/testsupport/testpostgres"
)

func account(t *testing.T, db *sql.DB, n int, role, username string) string {
	t.Helper()
	id := fmt.Sprintf("%032x", n)
	_, err := db.Exec(`INSERT INTO users(id,full_name,email,password_hash,role,city,created_at,username) VALUES($1,'Profil QA',$2,'hash',$3,'Ankara',now(),NULLIF($4,''))`, id, id+"@example.com", role, username)
	if err != nil {
		t.Fatal(err)
	}
	if role == "club" {
		if _, err = db.Exec(`INSERT INTO clubs(user_id,updated_at) VALUES($1,now())`, id); err != nil {
			t.Fatal(err)
		}
	}
	return id
}

func intp(v int) *int { return &v }

// Requires TEST_DATABASE_URL; skipped otherwise.
func TestProfileFieldsAndAvatar(t *testing.T) {
	db := testpostgres.New(t).DB
	ctx := context.Background()
	svc := application.New(data.New(db))
	player := account(t, db, 1, "player", "")
	club := account(t, db, 2, "club", "demo.kulup")

	in := application.Input{FullName: "  Ali   Yılmaz ", City: "Ankara", District: "Çankaya", BirthDate: "2004-05-17", Bio: "Sol bek.", HeightCm: intp(181), WeightKg: intp(74)}
	p, err := svc.Save(ctx, player, in)
	if err != nil || p.FullName != "Ali Yılmaz" || p.District != "Çankaya" || p.BirthDate == nil || p.BirthDate.Format("2006-01-02") != "2004-05-17" || *p.HeightCm != 181 || p.Username != "" {
		t.Fatalf("save: %+v %v", p, err)
	}
	var fields auth.ValidationError
	for _, bad := range []application.Input{
		{FullName: "A", City: "Ankara"},
		{FullName: "Ali", City: "Ankara", HeightCm: intp(300)},
		{FullName: "Ali", City: "Ankara", BirthDate: "2030-01-01"},
		{FullName: "Ali", City: "Ankara", Username: "Büyük Harf"},
	} {
		if _, err = svc.Save(ctx, player, bad); !errors.As(err, &fields) {
			t.Fatalf("invalid input accepted: %+v %v", bad, err)
		}
	}
	if _, err = svc.Save(ctx, player, application.Input{FullName: "Ali", City: "Ankara", Username: "demo.kulup"}); !errors.As(err, &fields) || fields["username"] == "" {
		t.Fatalf("duplicate username accepted: %v", err)
	}
	if _, err = svc.Save(ctx, club, application.Input{FullName: "Kulüp", City: "Ankara"}); !errors.As(err, &fields) {
		t.Fatal("a club cannot clear its sign-in username")
	}
	cleared, err := svc.Save(ctx, player, application.Input{FullName: "Ali Yılmaz", City: "Ankara"})
	if err != nil || cleared.BirthDate != nil || cleared.HeightCm != nil || cleared.Bio != "" {
		t.Fatalf("optional fields not cleared: %+v %v", cleared, err)
	}

	if _, err = svc.SetAvatar(ctx, player, []byte("not an image")); !errors.As(err, &fields) {
		t.Fatal("non-image avatar accepted")
	}
	img := image.NewRGBA(image.Rect(0, 0, 4, 4))
	var buf bytes.Buffer
	if err = png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	first, err := svc.SetAvatar(ctx, player, buf.Bytes())
	if err != nil || first.AvatarVersion != 1 {
		t.Fatalf("avatar: %+v %v", first, err)
	}
	second, _ := svc.SetAvatar(ctx, player, buf.Bytes())
	if second.AvatarVersion != 2 {
		t.Fatal("each upload must bump the version")
	}
	file, err := svc.Avatar(ctx, club, player)
	if err != nil || file.MIME != "image/png" || len(file.Data) == 0 {
		t.Fatalf("read avatar: %v", err)
	}
	// A block either way hides the photo from both sides.
	if _, err = db.Exec(`INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, player, club); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.Avatar(ctx, club, player); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("blocked viewer got the photo: %v", err)
	}
	if _, err = svc.Avatar(ctx, player, player); err != nil {
		t.Fatalf("owner lost their own photo: %v", err)
	}
	if _, err = db.Exec(`DELETE FROM user_blocks`); err != nil {
		t.Fatal(err)
	}
	removed, err := svc.DeleteAvatar(ctx, player)
	if err != nil || removed.AvatarVersion != 0 {
		t.Fatalf("delete: %+v %v", removed, err)
	}
	if _, err = svc.Avatar(ctx, club, player); !errors.Is(err, domain.ErrNotFound) {
		t.Fatal("deleted avatar still served")
	}
	if _, err = db.Exec(`UPDATE users SET active=false WHERE id=$1`, club); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.Get(ctx, club); !errors.Is(err, domain.ErrForbidden) {
		t.Fatal("inactive account edited its profile")
	}
}
