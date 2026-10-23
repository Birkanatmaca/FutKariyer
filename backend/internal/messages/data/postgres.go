package data

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"time"
	"unicode/utf8"

	"futcareer/backend/internal/messages/domain"
	moderation "futcareer/backend/internal/moderation/data"
	notificationsdata "futcareer/backend/internal/notifications/data"
	notificationsdomain "futcareer/backend/internal/notifications/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

// Eligible is the messaging rule for other modules (the social profile's
// Mesaj button): $1 the viewer, $2 the other account.
func Eligible() string { return eligible }

// eligible: $1 and $2 are active, neither blocked the other, and they are an
// accepted connection or a club and one of its current squad players.
var eligible = `EXISTS(SELECT 1 FROM users me JOIN users them ON them.id=$2 AND them.active
	WHERE me.id=$1 AND me.active AND ` + moderation.NotBlocked("$1", "$2") + ` AND (
	EXISTS(SELECT 1 FROM connection_requests c WHERE c.status='accepted' AND ((c.sender_id=$1 AND c.recipient_id=$2) OR (c.sender_id=$2 AND c.recipient_id=$1)))
	OR EXISTS(SELECT 1 FROM club_squad_members m WHERE m.left_at IS NULL AND ((m.club_user_id=$1 AND m.player_id=$2) OR (m.club_user_id=$2 AND m.player_id=$1)))))`

func pair(a, b string) (string, string) {
	if a < b {
		return a, b
	}
	return b, a
}

func (r *Postgres) partner(ctx context.Context, q interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}, userID, partnerID string) (domain.Partner, error) {
	var p domain.Partner
	err := q.QueryRowContext(ctx, `SELECT u.id,u.full_name,u.role,u.verified,u.avatar_version FROM users u
		WHERE u.id=$2 AND u.active AND u.role IN ('player','club','coach','organizer') AND `+moderation.NotBlocked("$1", "u.id"), userID, partnerID).
		Scan(&p.ID, &p.FullName, &p.Role, &p.Verified, &p.AvatarVersion)
	if errors.Is(err, sql.ErrNoRows) {
		return p, domain.ErrNotFound
	}
	return p, err
}

// Inbox lists the user's conversations with a message, latest first.
func (r *Postgres) Inbox(ctx context.Context, userID string) (domain.Inbox, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT u.id,u.full_name,u.role,u.verified,u.avatar_version,c.last_message_at,
		lm.id,lm.body,lm.sender_id=$1,lm.created_at,
		(SELECT count(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>$1
			AND m.created_at > COALESCE(CASE WHEN c.user_a=$1 THEN c.a_read_at ELSE c.b_read_at END,'-infinity'))::int
		FROM conversations c
		JOIN users u ON u.id = CASE WHEN c.user_a=$1 THEN c.user_b ELSE c.user_a END AND u.active
		JOIN LATERAL (SELECT id,body,sender_id,created_at FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1) lm ON true
		WHERE (c.user_a=$1 OR c.user_b=$1) AND `+moderation.NotBlocked("$1", "u.id")+`
		ORDER BY c.last_message_at DESC LIMIT 100`, userID)
	if err != nil {
		return domain.Inbox{}, err
	}
	defer rows.Close()
	out := domain.Inbox{Items: []domain.Conversation{}}
	for rows.Next() {
		var c domain.Conversation
		var m domain.Message
		if err := rows.Scan(&c.Partner.ID, &c.Partner.FullName, &c.Partner.Role, &c.Partner.Verified, &c.Partner.AvatarVersion, &c.UpdatedAt,
			&m.ID, &m.Body, &m.Mine, &m.CreatedAt, &c.Unread); err != nil {
			return out, err
		}
		c.UpdatedAt, m.CreatedAt = c.UpdatedAt.UTC(), m.CreatedAt.UTC()
		c.LastMessage = &m
		out.Unread += c.Unread
		out.Items = append(out.Items, c)
	}
	if err := rows.Err(); err != nil {
		return out, err
	}
	// Whether each partner can still be written to (a left squad player or a
	// removed connection keeps the history read-only).
	for i := range out.Items {
		if err := r.db.QueryRowContext(ctx, `SELECT `+eligible, userID, out.Items[i].Partner.ID).Scan(&out.Items[i].CanSend); err != nil {
			return out, err
		}
	}
	return out, nil
}

// Thread pages one conversation, newest first, and says whether the user may write.
func (r *Postgres) Thread(ctx context.Context, userID, partnerID string, before domain.Cursor) (domain.Thread, error) {
	out := domain.Thread{Items: []domain.Message{}}
	p, err := r.partner(ctx, r.db, userID, partnerID)
	if err != nil {
		return out, err
	}
	out.Partner = p
	if err = r.db.QueryRowContext(ctx, `SELECT `+eligible, userID, partnerID).Scan(&out.CanSend); err != nil {
		return out, err
	}
	a, b := pair(userID, partnerID)
	var conversationID string
	var aRead, bRead sql.NullTime
	err = r.db.QueryRowContext(ctx, `SELECT id,a_read_at,b_read_at FROM conversations WHERE user_a=$1 AND user_b=$2`, a, b).Scan(&conversationID, &aRead, &bRead)
	if errors.Is(err, sql.ErrNoRows) {
		return out, nil
	}
	if err != nil {
		return out, err
	}
	partnerRead := aRead
	if a == userID {
		partnerRead = bRead
	}
	if partnerRead.Valid {
		at := partnerRead.Time.UTC()
		out.PartnerReadAt = &at
	}
	rows, err := r.db.QueryContext(ctx, `SELECT id,body,sender_id=$2,created_at FROM messages
		WHERE conversation_id=$1 AND ($3='' OR (created_at,id)<($4::timestamptz,$3))
		ORDER BY created_at DESC,id DESC LIMIT $5`, conversationID, userID, before.ID, before.CreatedAt, domain.PageSize+1)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var m domain.Message
		if err := rows.Scan(&m.ID, &m.Body, &m.Mine, &m.CreatedAt); err != nil {
			return out, err
		}
		m.CreatedAt = m.CreatedAt.UTC()
		out.Items = append(out.Items, m)
	}
	return out, rows.Err()
}

// Send stores a message and tells the partner once per unread burst: the
// notification key changes only after the partner reads the conversation.
func (r *Postgres) Send(ctx context.Context, userID, partnerID, messageID, conversationID, body string) (domain.Message, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Message{}, err
	}
	defer tx.Rollback()
	// Lock the sender so the per-minute cap holds under concurrent sends.
	if _, err = tx.ExecContext(ctx, `SELECT 1 FROM users WHERE id=$1 FOR UPDATE`, userID); err != nil {
		return domain.Message{}, err
	}
	var allowed bool
	if err = tx.QueryRowContext(ctx, `SELECT `+eligible, userID, partnerID).Scan(&allowed); err != nil {
		return domain.Message{}, err
	}
	if !allowed {
		if _, err := r.partner(ctx, tx, userID, partnerID); err != nil {
			return domain.Message{}, err
		}
		return domain.Message{}, domain.ErrNotAllowed
	}
	var recent int
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM messages WHERE sender_id=$1 AND created_at > clock_timestamp() - interval '1 minute'`, userID).Scan(&recent); err != nil {
		return domain.Message{}, err
	}
	if recent >= domain.PerMinute {
		return domain.Message{}, domain.ErrRateLimited
	}
	a, b := pair(userID, partnerID)
	var partnerRead sql.NullTime
	err = tx.QueryRowContext(ctx, `INSERT INTO conversations(id,user_a,user_b) VALUES($1,$2,$3)
		ON CONFLICT (user_a,user_b) DO UPDATE SET last_message_at=clock_timestamp()
		RETURNING id, CASE WHEN user_a=$4 THEN b_read_at ELSE a_read_at END`, conversationID, a, b, userID).Scan(&conversationID, &partnerRead)
	if err != nil {
		return domain.Message{}, err
	}
	m := domain.Message{ID: messageID, Body: body, Mine: true}
	if err = tx.QueryRowContext(ctx, `INSERT INTO messages(id,conversation_id,sender_id,body) VALUES($1,$2,$3,$4) RETURNING created_at`, messageID, conversationID, userID, body).Scan(&m.CreatedAt); err != nil {
		return domain.Message{}, err
	}
	m.CreatedAt = m.CreatedAt.UTC()
	// Writing counts as reading the conversation for the sender.
	if _, err = tx.ExecContext(ctx, `UPDATE conversations SET last_message_at=$2,
		a_read_at=CASE WHEN user_a=$3 THEN $2 ELSE a_read_at END,
		b_read_at=CASE WHEN user_b=$3 THEN $2 ELSE b_read_at END WHERE id=$1`, conversationID, m.CreatedAt, userID); err != nil {
		return domain.Message{}, err
	}
	burst := "0"
	if partnerRead.Valid {
		burst = strconv.FormatInt(partnerRead.Time.UnixNano(), 10)
	}
	preview := body
	if utf8.RuneCountInString(preview) > 80 {
		preview = string([]rune(preview)[:80]) + "…"
	}
	if err = notificationsdata.CreateInTx(ctx, tx, notificationsdomain.NewNotification{
		RecipientID: partnerID, Kind: notificationsdomain.KindMessage, ActorID: userID,
		Title: "Yeni mesaj", Body: notificationsdomain.Actor + ": " + preview,
		ResourceID: userID, SourceKey: "message:" + conversationID + ":" + burst,
	}); err != nil {
		return domain.Message{}, err
	}
	return m, tx.Commit()
}

// MarkRead marks the conversation and its message notifications read.
func (r *Postgres) MarkRead(ctx context.Context, userID, partnerID string) error {
	a, b := pair(userID, partnerID)
	now := time.Now().UTC()
	if _, err := r.db.ExecContext(ctx, `UPDATE conversations SET
		a_read_at=CASE WHEN user_a=$3 THEN $4 ELSE a_read_at END,
		b_read_at=CASE WHEN user_b=$3 THEN $4 ELSE b_read_at END
		WHERE user_a=$1 AND user_b=$2`, a, b, userID, now); err != nil {
		return err
	}
	_, err := r.db.ExecContext(ctx, `UPDATE notifications SET read_at=$3 WHERE recipient_id=$1 AND kind='message' AND resource_id=$2 AND read_at IS NULL`, userID, partnerID, now)
	return err
}
