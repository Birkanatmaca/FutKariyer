package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	notificationdomain "futcareer/backend/internal/notifications/domain"
	"strings"
	"time"

	"futcareer/backend/internal/coaches/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

// Profile columns, coalesced so a coach without a saved profile reads as empty.
const profileColumns = `COALESCE(p.license_level,'unknown'), COALESCE(array_to_string(p.specialties,','),''),
	COALESCE(p.experience_years,0), COALESCE(p.football_type,'unknown'), COALESCE(p.availability,'not_available'),
	COALESCE(to_json(p.past_clubs)::text,'[]'), COALESCE(p.show_license,false), COALESCE(p.show_experience,false),
	COALESCE(p.show_football,false), COALESCE(p.show_clubs,false)`

type scanner interface{ Scan(...any) error }

func split(list string) []string {
	if list == "" {
		return []string{}
	}
	return strings.Split(list, ",")
}

func profileTargets(p *domain.Profile, specialties, clubs *string) []any {
	return []any{&p.LicenseLevel, specialties, &p.ExperienceYears, &p.FootballType, &p.Availability, clubs,
		&p.Visibility.License, &p.Visibility.Experience, &p.Visibility.Football, &p.Visibility.Clubs}
}

func finishProfile(p *domain.Profile, specialties, clubs string) error {
	p.Specialties = split(specialties)
	p.PastClubs = []string{}
	return json.Unmarshal([]byte(clubs), &p.PastClubs)
}

func (r *Postgres) Profile(ctx context.Context, coachID string) (domain.Profile, error) {
	var p domain.Profile
	var specialties, clubs string
	err := r.db.QueryRowContext(ctx, `SELECT `+profileColumns+` FROM users u LEFT JOIN coach_profiles p ON p.user_id=u.id
		WHERE u.id=$1 AND u.role='coach'`, coachID).Scan(profileTargets(&p, &specialties, &clubs)...)
	if errors.Is(err, sql.ErrNoRows) {
		return p, domain.ErrNotFound
	}
	if err != nil {
		return p, err
	}
	return p, finishProfile(&p, specialties, clubs)
}

func (r *Postgres) SaveProfile(ctx context.Context, coachID string, p domain.Profile) (domain.Profile, error) {
	clubs, err := json.Marshal(p.PastClubs)
	if err != nil {
		return p, err
	}
	result, err := r.db.ExecContext(ctx, `INSERT INTO coach_profiles(user_id,license_level,specialties,experience_years,football_type,
			availability,past_clubs,show_license,show_experience,show_football,show_clubs,updated_at)
		SELECT u.id,$2,COALESCE(string_to_array(NULLIF($3,''),','),'{}'),$4,$5,$6,ARRAY(SELECT json_array_elements_text($7::json)),$8,$9,$10,$11,now()
		FROM users u WHERE u.id=$1 AND u.role='coach'
		ON CONFLICT(user_id) DO UPDATE SET license_level=EXCLUDED.license_level, specialties=EXCLUDED.specialties,
			experience_years=EXCLUDED.experience_years, football_type=EXCLUDED.football_type, availability=EXCLUDED.availability,
			past_clubs=EXCLUDED.past_clubs, show_license=EXCLUDED.show_license, show_experience=EXCLUDED.show_experience,
			show_football=EXCLUDED.show_football, show_clubs=EXCLUDED.show_clubs, updated_at=now()`,
		coachID, p.LicenseLevel, strings.Join(p.Specialties, ","), p.ExperienceYears, p.FootballType, p.Availability, string(clubs),
		p.Visibility.License, p.Visibility.Experience, p.Visibility.Football, p.Visibility.Clubs)
	if err != nil {
		return p, err
	}
	if n, err := result.RowsAffected(); err != nil || n != 1 {
		if err == nil {
			err = domain.ErrNotFound
		}
		return p, err
	}
	return r.Profile(ctx, coachID)
}

const personColumns = `u.id,u.full_name,u.verified,u.district,u.avatar_version`

func (r *Postgres) Staff(ctx context.Context, clubID string) ([]domain.Member, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+personColumns+`,s.status,s.role,array_to_string(s.permissions,','),s.invited_at,s.joined_at,`+profileColumns+`
		FROM club_staff s JOIN users u ON u.id=s.coach_user_id LEFT JOIN coach_profiles p ON p.user_id=u.id
		WHERE s.club_user_id=$1 AND u.active
		ORDER BY s.status='invited', s.joined_at, lower(u.full_name), u.id`, clubID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Member{}
	for rows.Next() {
		var m domain.Member
		var permissions, specialties, clubs string
		var joined sql.NullTime
		targets := []any{&m.Coach.ID, &m.Coach.FullName, &m.Coach.Verified, &m.Coach.District, &m.Coach.AvatarVersion,
			&m.Status, &m.Role, &permissions, &m.InvitedAt, &joined}
		if err := rows.Scan(append(targets, profileTargets(&m.Profile, &specialties, &clubs)...)...); err != nil {
			return nil, err
		}
		if err := finishProfile(&m.Profile, specialties, clubs); err != nil {
			return nil, err
		}
		m.Permissions = split(permissions)
		m.InvitedAt = m.InvitedAt.UTC()
		if joined.Valid {
			t := joined.Time.UTC()
			m.JoinedAt = &t
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *Postgres) Candidates(ctx context.Context, clubID, query string) ([]domain.Candidate, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+personColumns+`,`+profileColumns+`
		FROM users u LEFT JOIN coach_profiles p ON p.user_id=u.id
		WHERE u.role='coach' AND u.active AND u.full_name ILIKE '%' || $2 || '%'
			AND NOT EXISTS (SELECT 1 FROM club_staff s WHERE s.club_user_id=$1 AND s.coach_user_id=u.id)
		ORDER BY u.verified DESC, lower(u.full_name), u.id LIMIT 20`, clubID, escapeLike(query))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Candidate{}
	for rows.Next() {
		var c domain.Candidate
		var specialties, clubs string
		targets := []any{&c.Coach.ID, &c.Coach.FullName, &c.Coach.Verified, &c.Coach.District, &c.Coach.AvatarVersion}
		if err := rows.Scan(append(targets, profileTargets(&c.Profile, &specialties, &clubs)...)...); err != nil {
			return nil, err
		}
		if err := finishProfile(&c.Profile, specialties, clubs); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

// notify adds one in-app notification inside the caller's transaction. The
// resource is the other account (club or coach); its name is not stored but
// shown in place of actor (20 Oct 2026).
func notify(ctx context.Context, tx *sql.Tx, recipient, title, body, resource string) error {
	_, err := tx.ExecContext(ctx, `INSERT INTO notifications(id,recipient_id,kind,title,body,resource_id,source_key,actor_id)
		VALUES(md5(random()::text || clock_timestamp()::text || $1),$1,'staff',$2,$3,$4,'staff:' || md5(random()::text || clock_timestamp()::text),$4)`,
		recipient, title, body, resource)
	return err
}

const actor = notificationdomain.Actor

func (r *Postgres) Invite(ctx context.Context, clubID, coachID, role string, permissions []string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	// Lock the club row so the staff limit holds under concurrent invites.
	var club string
	if err := tx.QueryRowContext(ctx, `SELECT full_name FROM users WHERE id=$1 AND role='club' AND active FOR UPDATE`, clubID).Scan(&club); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	var count int
	if err := tx.QueryRowContext(ctx, `SELECT count(*) FROM club_staff WHERE club_user_id=$1`, clubID).Scan(&count); err != nil {
		return err
	}
	if count >= domain.MaxStaff {
		return domain.ErrStaffLimit
	}
	result, err := tx.ExecContext(ctx, `INSERT INTO club_staff(club_user_id,coach_user_id,status,role,permissions)
		SELECT $1,u.id,'invited',$3,COALESCE(string_to_array(NULLIF($4,''),','),'{}') FROM users u WHERE u.id=$2 AND u.role='coach' AND u.active
		ON CONFLICT DO NOTHING`, clubID, coachID, role, strings.Join(permissions, ","))
	if err != nil {
		return err
	}
	if n, err := result.RowsAffected(); err != nil {
		return err
	} else if n == 0 {
		var exists bool
		if err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM club_staff WHERE club_user_id=$1 AND coach_user_id=$2)`, clubID, coachID).Scan(&exists); err != nil {
			return err
		}
		if exists {
			return domain.ErrExists
		}
		return domain.ErrNotFound
	}
	if err := notify(ctx, tx, coachID, actor+" seni teknik ekibine davet etti",
		"Daveti Kulüplerim ekranından kabul edebilir veya reddedebilirsin.", clubID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Postgres) UpdateMember(ctx context.Context, clubID, coachID, role string, permissions []string) error {
	result, err := r.db.ExecContext(ctx, `UPDATE club_staff SET role=$3, permissions=COALESCE(string_to_array(NULLIF($4,''),','),'{}')
		WHERE club_user_id=$1 AND coach_user_id=$2`, clubID, coachID, role, strings.Join(permissions, ","))
	if err != nil {
		return err
	}
	if n, err := result.RowsAffected(); err != nil || n == 0 {
		if err == nil {
			err = domain.ErrNotFound
		}
		return err
	}
	return nil
}

// end removes a staff link and every club session the coach opened with it.
func end(ctx context.Context, tx *sql.Tx, clubID, coachID string) (status string, err error) {
	err = tx.QueryRowContext(ctx, `DELETE FROM club_staff WHERE club_user_id=$1 AND coach_user_id=$2 RETURNING status`, clubID, coachID).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return "", domain.ErrNotFound
	}
	if err != nil {
		return "", err
	}
	_, err = tx.ExecContext(ctx, `DELETE FROM sessions WHERE user_id=$1 AND acting_user_id=$2`, clubID, coachID)
	return status, err
}

func (r *Postgres) RemoveMember(ctx context.Context, clubID, coachID string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	status, err := end(ctx, tx, clubID, coachID)
	if err != nil {
		return err
	}
	if status == "active" {
		if err := notify(ctx, tx, coachID, actor+" teknik ekibinden çıkarıldın",
			"Kulübün hesabına geçiş yetkin kaldırıldı.", clubID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *Postgres) Memberships(ctx context.Context, coachID string) ([]domain.Membership, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT u.id,u.full_name,u.verified,COALESCE(NULLIF(c.district,''),u.district),u.avatar_version,
			s.status,s.role,array_to_string(s.permissions,','),s.invited_at,s.joined_at
		FROM club_staff s JOIN users u ON u.id=s.club_user_id LEFT JOIN clubs c ON c.user_id=u.id
		WHERE s.coach_user_id=$1 AND u.active
		ORDER BY s.status='active', s.invited_at DESC, lower(u.full_name)`, coachID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Membership{}
	for rows.Next() {
		var m domain.Membership
		var permissions string
		var joined sql.NullTime
		if err := rows.Scan(&m.Club.ID, &m.Club.FullName, &m.Club.Verified, &m.Club.District, &m.Club.AvatarVersion,
			&m.Status, &m.Role, &permissions, &m.InvitedAt, &joined); err != nil {
			return nil, err
		}
		m.Permissions = split(permissions)
		m.InvitedAt = m.InvitedAt.UTC()
		if joined.Valid {
			t := joined.Time.UTC()
			m.JoinedAt = &t
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *Postgres) Respond(ctx context.Context, coachID, clubID string, accept bool) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if accept {
		result, err := tx.ExecContext(ctx, `UPDATE club_staff SET status='active', joined_at=$3
			WHERE club_user_id=$1 AND coach_user_id=$2 AND status='invited'`, clubID, coachID, time.Now().UTC())
		if err != nil {
			return err
		}
		if n, err := result.RowsAffected(); err != nil || n == 0 {
			if err == nil {
				err = domain.ErrNotFound
			}
			return err
		}
		if err := notify(ctx, tx, clubID, actor+" teknik ekibine katıldı",
			"Davetini kabul etti; verdiğin izinlerle kulüp hesabına geçebilir.", coachID); err != nil {
			return err
		}
		return tx.Commit()
	}
	result, err := tx.ExecContext(ctx, `DELETE FROM club_staff WHERE club_user_id=$1 AND coach_user_id=$2 AND status='invited'`, clubID, coachID)
	if err != nil {
		return err
	}
	if n, err := result.RowsAffected(); err != nil || n == 0 {
		if err == nil {
			err = domain.ErrNotFound
		}
		return err
	}
	if err := notify(ctx, tx, clubID, actor+" teknik ekip davetini reddetti", "Dilersen başka bir antrenörü davet edebilirsin.", coachID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Postgres) Leave(ctx context.Context, coachID, clubID string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	status, err := end(ctx, tx, clubID, coachID)
	if err != nil {
		return err
	}
	if status != "active" {
		return domain.ErrNotFound
	}
	if err := notify(ctx, tx, clubID, actor+" teknik ekipten ayrıldı", "Antrenörün kulüp hesabına geçiş yetkisi sona erdi.", coachID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Postgres) PublicStaff(ctx context.Context, clubID string) ([]domain.StaffCard, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+personColumns+`,s.role FROM club_staff s JOIN users u ON u.id=s.coach_user_id
		WHERE s.club_user_id=$1 AND s.status='active' AND u.active ORDER BY s.joined_at, lower(u.full_name), u.id`, clubID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.StaffCard{}
	for rows.Next() {
		var c domain.StaffCard
		if err := rows.Scan(&c.Coach.ID, &c.Coach.FullName, &c.Coach.Verified, &c.Coach.District, &c.Coach.AvatarVersion, &c.Role); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *Postgres) ActiveClubs(ctx context.Context, coachID string) ([]domain.ClubCard, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT u.id,u.full_name,u.verified,COALESCE(NULLIF(c.district,''),u.district),u.avatar_version,s.role
		FROM club_staff s JOIN users u ON u.id=s.club_user_id LEFT JOIN clubs c ON c.user_id=u.id
		WHERE s.coach_user_id=$1 AND s.status='active' AND u.active ORDER BY s.joined_at, lower(u.full_name), u.id`, coachID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.ClubCard{}
	for rows.Next() {
		var c domain.ClubCard
		if err := rows.Scan(&c.Club.ID, &c.Club.FullName, &c.Club.Verified, &c.Club.District, &c.Club.AvatarVersion, &c.Role); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
