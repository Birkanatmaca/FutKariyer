package data

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"time"

	notificationsdata "futcareer/backend/internal/notifications/data"
	notificationsdomain "futcareer/backend/internal/notifications/domain"
	"futcareer/backend/internal/squadinvites/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

const columns = `i.id,i.club_user_id,c.full_name,i.player_id,p.full_name,COALESCE(pp.position,''),i.message,i.status,i.created_at,i.decided_at`
const joins = ` FROM club_squad_invites i JOIN users c ON c.id=i.club_user_id JOIN users p ON p.id=i.player_id LEFT JOIN player_profiles pp ON pp.user_id=p.id`

type scanner interface{ Scan(...any) error }

func scan(row scanner) (domain.Invite, error) {
	var v domain.Invite
	var decided sql.NullTime
	err := row.Scan(&v.ID, &v.ClubID, &v.ClubName, &v.PlayerID, &v.PlayerName, &v.Position, &v.Message, &v.Status, &v.CreatedAt, &decided)
	if errors.Is(err, sql.ErrNoRows) {
		return v, domain.ErrNotFound
	}
	v.CreatedAt = v.CreatedAt.UTC()
	if decided.Valid {
		at := decided.Time.UTC()
		v.DecidedAt = &at
	}
	return v, err
}

func list(rows *sql.Rows, err error) ([]domain.Invite, error) {
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Invite{}
	for rows.Next() {
		v, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// blocked is true when either side blocked the other.
const notBlocked = `NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))`

// Candidates follows the discovery rule: only active, discoverable players,
// none already in the squad or holding an open invitation.
func (r *Postgres) Candidates(ctx context.Context, clubID, search string) ([]domain.Candidate, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT u.id,u.full_name,COALESCE(pp.position,'') FROM users u JOIN player_profiles pp ON pp.user_id=u.id
		WHERE u.active AND u.role='player' AND pp.discoverable AND strpos(lower(u.full_name),lower($2)) > 0 AND `+notBlocked+`
		  AND NOT EXISTS (SELECT 1 FROM club_squad_members m WHERE m.club_user_id=$1 AND m.player_id=u.id AND m.left_at IS NULL)
		  AND NOT EXISTS (SELECT 1 FROM club_squad_invites i WHERE i.club_user_id=$1 AND i.player_id=u.id AND i.status='pending')
		ORDER BY lower(u.full_name),u.id LIMIT 20`, clubID, search)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Candidate{}
	for rows.Next() {
		var c domain.Candidate
		if err := rows.Scan(&c.ID, &c.Name, &c.Position); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *Postgres) ClubInvites(ctx context.Context, clubID string) ([]domain.Invite, error) {
	return list(r.db.QueryContext(ctx, `SELECT `+columns+joins+` WHERE i.club_user_id=$1 AND (i.status='pending' OR i.decided_at > clock_timestamp() - interval '30 days')
		ORDER BY i.status='pending' DESC,i.created_at DESC,i.id LIMIT 100`, clubID))
}

func stamp() string { return strconv.FormatInt(time.Now().UnixNano(), 10) }

func (r *Postgres) Invite(ctx context.Context, clubID, playerID, id, message string) (domain.Invite, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Invite{}, err
	}
	defer tx.Rollback()
	// Lock the club so the open-invitation cap holds under concurrent invites.
	var clubName string
	if err = tx.QueryRowContext(ctx, `SELECT full_name FROM users WHERE id=$1 AND role='club' AND active FOR UPDATE`, clubID).Scan(&clubName); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Invite{}, domain.ErrNotInvitable
		}
		return domain.Invite{}, err
	}
	var open int
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM club_squad_invites WHERE club_user_id=$1 AND status='pending'`, clubID).Scan(&open); err != nil {
		return domain.Invite{}, err
	}
	if open >= domain.MaxOpen {
		return domain.Invite{}, domain.ErrLimit
	}
	var ok bool
	if err = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM users u JOIN player_profiles pp ON pp.user_id=u.id
		WHERE u.id=$2 AND u.active AND u.role='player' AND pp.discoverable AND `+notBlocked+`
		  AND NOT EXISTS (SELECT 1 FROM club_squad_members m WHERE m.club_user_id=$1 AND m.player_id=u.id AND m.left_at IS NULL)
		  AND NOT EXISTS (SELECT 1 FROM club_squad_invites i WHERE i.club_user_id=$1 AND i.player_id=u.id AND i.status='pending'))`, clubID, playerID).Scan(&ok); err != nil {
		return domain.Invite{}, err
	}
	if !ok {
		return domain.Invite{}, domain.ErrNotInvitable
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO club_squad_invites(id,club_user_id,player_id,message) VALUES($1,$2,$3,$4)`, id, clubID, playerID, message); err != nil {
		return domain.Invite{}, err
	}
	if err = notificationsdata.CreateInTx(ctx, tx, notificationsdomain.NewNotification{
		RecipientID: playerID, Kind: notificationsdomain.KindSquadInvite, ActorID: clubID,
		Title: "Kadro daveti", Body: notificationsdomain.Actor + " seni kadrosuna davet etti.",
		ResourceID: id, SourceKey: "squad-invite:" + id + ":new",
	}); err != nil {
		return domain.Invite{}, err
	}
	out, err := scan(tx.QueryRowContext(ctx, `SELECT `+columns+joins+` WHERE i.id=$1`, id))
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

func (r *Postgres) Cancel(ctx context.Context, clubID, id string) (domain.Invite, error) {
	res, err := r.db.ExecContext(ctx, `UPDATE club_squad_invites SET status='cancelled',decided_at=clock_timestamp() WHERE id=$1 AND club_user_id=$2 AND status='pending'`, id, clubID)
	if err != nil {
		return domain.Invite{}, err
	}
	out, err := scan(r.db.QueryRowContext(ctx, `SELECT `+columns+joins+` WHERE i.id=$1 AND i.club_user_id=$2`, id, clubID))
	if err != nil {
		return out, err
	}
	if n, _ := res.RowsAffected(); n == 0 && out.Status != "cancelled" {
		return out, domain.ErrInvalidState
	}
	return out, nil
}

// PlayerInvites lists the player's open invitations from active clubs.
func (r *Postgres) PlayerInvites(ctx context.Context, playerID string) ([]domain.Invite, error) {
	return list(r.db.QueryContext(ctx, `SELECT `+columns+joins+` WHERE i.player_id=$1 AND i.status='pending' AND c.active ORDER BY i.created_at DESC,i.id LIMIT 100`, playerID))
}

// Respond accepts (joining the squad) or declines; the club is notified.
func (r *Postgres) Respond(ctx context.Context, playerID, id string, accept bool) (domain.Invite, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Invite{}, err
	}
	defer tx.Rollback()
	var clubID, status string
	var clubActive bool
	err = tx.QueryRowContext(ctx, `SELECT i.club_user_id,i.status,c.active FROM club_squad_invites i JOIN users c ON c.id=i.club_user_id WHERE i.id=$1 AND i.player_id=$2 FOR UPDATE OF i`, id, playerID).Scan(&clubID, &status, &clubActive)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Invite{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Invite{}, err
	}
	if status != "pending" || (accept && !clubActive) {
		return domain.Invite{}, domain.ErrInvalidState
	}
	target, title, body := "declined", "Kadro daveti reddedildi", notificationsdomain.Actor+" kadro davetini kabul etmedi."
	if accept {
		target, title, body = "accepted", "Kadro daveti kabul edildi", notificationsdomain.Actor+" kadrona katıldı."
		if _, err = tx.ExecContext(ctx, `INSERT INTO club_squad_members(club_user_id,player_id) VALUES($1,$2)
			ON CONFLICT (club_user_id,player_id) DO UPDATE SET left_at=NULL,joined_at=clock_timestamp(),request_id=NULL`, clubID, playerID); err != nil {
			return domain.Invite{}, err
		}
	}
	if _, err = tx.ExecContext(ctx, `UPDATE club_squad_invites SET status=$2,decided_at=clock_timestamp() WHERE id=$1`, id, target); err != nil {
		return domain.Invite{}, err
	}
	if err = notificationsdata.CreateInTx(ctx, tx, notificationsdomain.NewNotification{
		RecipientID: clubID, Kind: notificationsdomain.KindSquadInvite, ActorID: playerID,
		Title: title, Body: body, ResourceID: id, SourceKey: "squad-invite:" + id + ":answer:" + stamp(),
	}); err != nil {
		return domain.Invite{}, err
	}
	out, err := scan(tx.QueryRowContext(ctx, `SELECT `+columns+joins+` WHERE i.id=$1`, id))
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}
