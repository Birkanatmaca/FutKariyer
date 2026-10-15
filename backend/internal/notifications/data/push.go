package data

import (
	"context"

	"futcareer/backend/internal/notifications/domain"
)

var _ domain.PushRepository = (*Postgres)(nil)

func (r *Postgres) RegisterDevice(ctx context.Context, userID, sessionHash, token, platform string) error {
	// A token moves to the latest session that registers it (shared devices).
	_, err := r.db.ExecContext(ctx, `INSERT INTO push_devices(token,user_id,session_hash,platform) VALUES($1,$2,$3,$4)
		ON CONFLICT(token) DO UPDATE SET user_id=EXCLUDED.user_id,session_hash=EXCLUDED.session_hash,platform=EXCLUDED.platform,updated_at=now()`,
		token, userID, sessionHash, platform)
	return err
}

func (r *Postgres) ClaimPending(ctx context.Context, limit int) ([]domain.PushMessage, error) {
	// Older than a day is stale for a push; it stays in the notification centre.
	rows, err := r.db.QueryContext(ctx, `UPDATE notifications SET pushed_at=now() WHERE id IN (
		SELECT id FROM notifications WHERE pushed_at IS NULL ORDER BY created_at,id LIMIT $1 FOR UPDATE SKIP LOCKED)
		RETURNING id,recipient_id,kind,title,body,resource_id,created_at>now()-interval '1 day'`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.PushMessage{}
	for rows.Next() {
		var item domain.PushMessage
		var fresh bool
		if err := rows.Scan(&item.NotificationID, &item.RecipientID, &item.Kind, &item.Title, &item.Body, &item.ResourceID, &fresh); err != nil {
			return nil, err
		}
		if fresh {
			out = append(out, item)
		}
	}
	return out, rows.Err()
}

func (r *Postgres) Devices(ctx context.Context, userIDs []string) ([]domain.PushDevice, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT d.token,d.user_id,d.platform FROM push_devices d JOIN users u ON u.id=d.user_id WHERE d.user_id=ANY($1) AND u.active`, userIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.PushDevice{}
	for rows.Next() {
		var item domain.PushDevice
		if err := rows.Scan(&item.Token, &item.UserID, &item.Platform); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Postgres) DeleteDevice(ctx context.Context, token string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM push_devices WHERE token=$1`, token)
	return err
}
