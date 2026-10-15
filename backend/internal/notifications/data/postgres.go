package data

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"strings"
	"unicode/utf8"

	"futcareer/backend/internal/notifications/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

type Executor interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}

func CreateInTx(ctx context.Context, tx Executor, item domain.NewNotification) error {
	if strings.TrimSpace(item.RecipientID) == "" ||
		!domain.ValidKind(item.Kind) ||
		utf8.RuneCountInString(item.Title) < 1 || utf8.RuneCountInString(item.Title) > 120 ||
		utf8.RuneCountInString(item.Body) < 1 || utf8.RuneCountInString(item.Body) > 500 ||
		len(item.ResourceID) != 32 || len(item.SourceKey) < 1 || len(item.SourceKey) > 320 {
		return errors.New("invalid notification")
	}
	idBytes := make([]byte, 16)
	if _, err := rand.Read(idBytes); err != nil {
		return err
	}
	id := hex.EncodeToString(idBytes)
	_, err := tx.ExecContext(ctx, `INSERT INTO notifications(id,recipient_id,kind,title,body,resource_id,source_key) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(recipient_id,source_key) DO NOTHING`, id, item.RecipientID, item.Kind, strings.TrimSpace(item.Title), strings.TrimSpace(item.Body), item.ResourceID, item.SourceKey)
	return err
}

func (r *Postgres) List(ctx context.Context, userID string, page, pageSize int) (domain.Page, error) {
	out := domain.Page{Items: []domain.Notification{}, Page: page, PageSize: pageSize}
	if err := r.db.QueryRowContext(ctx, `SELECT count(*) FROM notifications WHERE recipient_id=$1`, userID).Scan(&out.Total); err != nil {
		return out, err
	}
	if err := r.db.QueryRowContext(ctx, `SELECT count(*) FROM notifications WHERE recipient_id=$1 AND read_at IS NULL`, userID).Scan(&out.UnreadCount); err != nil {
		return out, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT id,kind,title,body,resource_id,created_at,read_at FROM notifications WHERE recipient_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`, userID, pageSize, (page-1)*pageSize)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var item domain.Notification
		var readAt sql.NullTime
		if err := rows.Scan(&item.ID, &item.Kind, &item.Title, &item.Body, &item.ResourceID, &item.CreatedAt, &readAt); err != nil {
			return out, err
		}
		item.CreatedAt = item.CreatedAt.UTC()
		if readAt.Valid {
			value := readAt.Time.UTC()
			item.ReadAt = &value
		}
		out.Items = append(out.Items, item)
	}
	if err := rows.Err(); err != nil {
		return out, err
	}
	if err := rows.Close(); err != nil {
		return out, err
	}
	out.TotalPages = (out.Total + pageSize - 1) / pageSize
	return out, nil
}

func (r *Postgres) UnreadCount(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `SELECT count(*) FROM notifications WHERE recipient_id=$1 AND read_at IS NULL`, userID).Scan(&count)
	return count, err
}

func (r *Postgres) MarkRead(ctx context.Context, userID, notificationID string) error {
	result, err := r.db.ExecContext(ctx, `UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND recipient_id=$2`, notificationID, userID)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) MarkAllRead(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE notifications SET read_at=now() WHERE recipient_id=$1 AND read_at IS NULL`, userID)
	return err
}
