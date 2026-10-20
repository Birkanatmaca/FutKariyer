package data

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"futcareer/backend/internal/connections/domain"
	moderation "futcareer/backend/internal/moderation/data"
	notificationsdata "futcareer/backend/internal/notifications/data"
	notificationsdomain "futcareer/backend/internal/notifications/domain"
	"github.com/jackc/pgx/v5/pgconn"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

type account struct {
	role, name   string
	verified     bool
	discoverable bool
}

// reachable applies the discovery rules: a player may reach verified clubs and
// coaches; a verified club or coach may reach discoverable players. Players do
// not send introductions to players.
func reachable(sender, recipient account) bool {
	switch sender.role {
	case "player":
		return (recipient.role == "club" || recipient.role == "coach") && recipient.verified
	case "club", "coach":
		return sender.verified && recipient.role == "player" && recipient.discoverable
	}
	return false
}

func lookup(ctx context.Context, tx *sql.Tx, id string, lock bool) (account, error) {
	query := `SELECT u.role,u.full_name,u.verified,COALESCE(p.discoverable,false) FROM users u LEFT JOIN player_profiles p ON p.user_id=u.id WHERE u.id=$1 AND u.active AND u.city='Ankara' AND u.role IN ('player','club','coach')`
	if lock {
		query += ` FOR UPDATE OF u`
	}
	var a account
	err := tx.QueryRowContext(ctx, query, id).Scan(&a.role, &a.name, &a.verified, &a.discoverable)
	if errors.Is(err, sql.ErrNoRows) {
		return a, domain.ErrNotFound
	}
	return a, err
}

func (r *Postgres) Send(ctx context.Context, id, senderID, recipientID, message string) (domain.Connection, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Connection{}, err
	}
	defer tx.Rollback()
	// Locking the sender serialises their requests, so the daily limit holds under concurrency.
	sender, err := lookup(ctx, tx, senderID, true)
	if err != nil {
		return domain.Connection{}, err
	}
	recipient, err := lookup(ctx, tx, recipientID, false)
	if err != nil {
		return domain.Connection{}, err
	}
	if !reachable(sender, recipient) {
		return domain.Connection{}, domain.ErrNotFound
	}
	if blocked, err := moderation.BlockedInTx(ctx, tx, senderID, recipientID); err != nil || blocked {
		if err == nil {
			err = domain.ErrNotFound
		}
		return domain.Connection{}, err
	}
	var recent int
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM connection_requests WHERE sender_id=$1 AND created_at > clock_timestamp() - interval '1 day'`, senderID).Scan(&recent); err != nil {
		return domain.Connection{}, err
	}
	if recent >= domain.DailyLimit {
		return domain.Connection{}, domain.ErrRateLimited
	}
	playerID, partnerID := senderID, recipientID
	if sender.role != "player" {
		playerID, partnerID = recipientID, senderID
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO connection_requests(id,sender_id,recipient_id,player_id,partner_id,message) VALUES($1,$2,$3,$4,$5,$6)`, id, senderID, recipientID, playerID, partnerID, message)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return domain.Connection{}, domain.ErrDuplicate
	}
	if err != nil {
		return domain.Connection{}, err
	}
	if err = notificationsdata.CreateInTx(ctx, tx, notificationsdomain.NewConnectionRequest(recipientID, id, senderID)); err != nil {
		return domain.Connection{}, err
	}
	out, err := one(ctx, tx, senderID, id)
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

// viewColumns renders a connection from the viewer's ($1) side; the other party is joined as o.
const viewColumns = `c.id,c.status,c.message,c.created_at,c.responded_at,c.sender_id=$1,o.id,o.full_name,o.role,o.verified,COALESCE(cl.district,''),COALESCE(o.email,'')`
const viewJoins = ` FROM connection_requests c
	JOIN users o ON o.id = CASE WHEN c.sender_id=$1 THEN c.recipient_id ELSE c.sender_id END
	LEFT JOIN clubs cl ON cl.user_id=o.id`

type scanner interface{ Scan(...any) error }

func scan(row scanner) (domain.Connection, error) {
	var c domain.Connection
	var responded sql.NullTime
	var outgoing bool
	var email string
	err := row.Scan(&c.ID, &c.Status, &c.Message, &c.CreatedAt, &responded, &outgoing, &c.Other.ID, &c.Other.Name, &c.Other.Role, &c.Other.Verified, &c.Other.District, &email)
	if errors.Is(err, sql.ErrNoRows) {
		return c, domain.ErrNotFound
	}
	if err != nil {
		return c, err
	}
	c.CreatedAt = c.CreatedAt.UTC()
	if responded.Valid {
		at := responded.Time.UTC()
		c.RespondedAt = &at
	}
	c.Direction = "incoming"
	if outgoing {
		c.Direction = "outgoing"
	}
	// Private contact opens only once both sides have agreed.
	if c.Status == "accepted" {
		c.Contact = &domain.Contact{Email: email}
	}
	return c, nil
}

func one(ctx context.Context, tx *sql.Tx, viewerID, id string) (domain.Connection, error) {
	return scan(tx.QueryRowContext(ctx, `SELECT `+viewColumns+viewJoins+` WHERE c.id=$2 AND (c.sender_id=$1 OR c.recipient_id=$1)`, viewerID, id))
}

func (r *Postgres) Inbox(ctx context.Context, userID string) (domain.Inbox, error) {
	out := domain.Inbox{Incoming: []domain.Connection{}, Outgoing: []domain.Connection{}, Accepted: []domain.Connection{}}
	rows, err := r.db.QueryContext(ctx, `SELECT `+viewColumns+viewJoins+`
		WHERE (c.sender_id=$1 OR c.recipient_id=$1) AND c.status IN ('pending','accepted') AND o.active
		ORDER BY COALESCE(c.responded_at,c.created_at) DESC,c.id DESC LIMIT 300`, userID)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		c, err := scan(rows)
		if err != nil {
			return out, err
		}
		switch {
		case c.Status == "accepted":
			out.Accepted = append(out.Accepted, c)
		case c.Direction == "outgoing":
			out.Outgoing = append(out.Outgoing, c)
		default:
			out.Incoming = append(out.Incoming, c)
		}
	}
	return out, rows.Err()
}

// Respond applies accept/decline (recipient) or cancel (sender) to a pending
// request. Repeating the action that already happened is a no-op.
func (r *Postgres) Respond(ctx context.Context, userID, id, action string) (domain.Connection, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Connection{}, err
	}
	defer tx.Rollback()
	var senderID, recipientID, status string
	err = tx.QueryRowContext(ctx, `SELECT c.sender_id,c.recipient_id,c.status FROM connection_requests c
		JOIN users s ON s.id=c.sender_id AND s.active JOIN users t ON t.id=c.recipient_id AND t.active
		WHERE c.id=$1 AND (c.sender_id=$2 OR c.recipient_id=$2) FOR UPDATE OF c`, id, userID).Scan(&senderID, &recipientID, &status)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Connection{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Connection{}, err
	}
	target := map[string]string{"accept": "accepted", "decline": "declined", "cancel": "cancelled"}[action]
	allowed := (action == "cancel" && userID == senderID) || (action != "cancel" && userID == recipientID)
	if !allowed {
		return domain.Connection{}, domain.ErrInvalidAction
	}
	if status == target {
		out, err := one(ctx, tx, userID, id)
		if err != nil {
			return out, err
		}
		return out, tx.Commit()
	}
	if status != "pending" {
		return domain.Connection{}, domain.ErrInvalidAction
	}
	if _, err = tx.ExecContext(ctx, `UPDATE connection_requests SET status=$2,responded_at=$3 WHERE id=$1`, id, target, time.Now().UTC()); err != nil {
		return domain.Connection{}, err
	}
	if target == "accepted" {
		if err = notificationsdata.CreateInTx(ctx, tx, notificationsdomain.NewConnectionAccepted(senderID, id, userID)); err != nil {
			return domain.Connection{}, err
		}
	}
	out, err := one(ctx, tx, userID, id)
	if err != nil {
		return out, err
	}
	return out, tx.Commit()
}

func (r *Postgres) Status(ctx context.Context, userID, otherID string) (domain.PairStatus, error) {
	var id, senderID, status string
	err := r.db.QueryRowContext(ctx, `SELECT id,sender_id,status FROM connection_requests
		WHERE ((sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1)) AND status IN ('pending','accepted')
		ORDER BY created_at DESC LIMIT 1`, userID, otherID).Scan(&id, &senderID, &status)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.PairStatus{State: "none"}, nil
	}
	if err != nil {
		return domain.PairStatus{}, err
	}
	switch {
	case status == "accepted":
		return domain.PairStatus{State: "connected", ConnectionID: id}, nil
	case senderID == userID:
		return domain.PairStatus{State: "outgoing", ConnectionID: id}, nil
	default:
		return domain.PairStatus{State: "incoming", ConnectionID: id}, nil
	}
}
