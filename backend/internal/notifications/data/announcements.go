package data

import (
	"context"
	"database/sql"
	"errors"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/notifications/domain"
)

var audienceRoles = map[string]string{"all": "", "player": "player", "club": "club", "coach": "coach", "account": ""}

// CreateAnnouncement stores a campaign and fans it out to matching accounts in
// the same transaction, so every recipient gets exactly one notification.
func (r *Postgres) CreateAnnouncement(ctx context.Context, a domain.Announcement, email string) (domain.Announcement, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return a, err
	}
	defer tx.Rollback()
	var target sql.NullString
	if a.Audience == "account" {
		err = tx.QueryRowContext(ctx, `SELECT id FROM users WHERE lower(email)=$1 AND active AND role IN ('player','club','coach')`, email).Scan(&target.String)
		if errors.Is(err, sql.ErrNoRows) {
			return a, auth.ValidationError{"email": "Bu e-posta ile aktif bir hesap bulunamadı."}
		}
		if err != nil {
			return a, err
		}
		target.Valid = true
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO announcements(id,kind,title,body,audience,target_user_id) VALUES($1,$2,$3,$4,$5,$6)`,
		a.ID, a.Kind, a.Title, a.Body, a.Audience, nullableString(target)); err != nil {
		return a, err
	}
	role := audienceRoles[a.Audience]
	res, err := tx.ExecContext(ctx, `INSERT INTO notifications(id,recipient_id,kind,title,body,resource_id,source_key)
		SELECT md5(random()::text || clock_timestamp()::text || u.id), u.id, 'opportunity', $1, $2, $3, 'announcement:' || $3
		FROM users u
		WHERE u.active AND u.role IN ('player','club','coach')
		  AND ($4 = '' OR u.role = $4)
		  AND ($5::text IS NULL OR u.id = $5)`,
		a.Title, a.Body, a.ID, role, nullableString(target))
	if err != nil {
		return a, err
	}
	count, err := res.RowsAffected()
	if err != nil {
		return a, err
	}
	if count == 0 {
		return a, domain.ErrNoRecipient
	}
	if err = tx.Commit(); err != nil {
		return a, err
	}
	a.Recipients = int(count)
	return a, nil
}

func nullableString(v sql.NullString) any {
	if !v.Valid {
		return nil
	}
	return v.String
}

func (r *Postgres) ListAnnouncements(ctx context.Context) ([]domain.Announcement, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT a.id,a.kind,a.title,a.body,a.audience,COALESCE(u.email,''),a.created_at,count(n.id)
		FROM announcements a
		LEFT JOIN users u ON u.id=a.target_user_id
		LEFT JOIN notifications n ON n.resource_id=a.id AND n.kind='opportunity'
		GROUP BY a.id,u.email
		ORDER BY a.created_at DESC,a.id DESC
		LIMIT 100`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Announcement{}
	for rows.Next() {
		var a domain.Announcement
		if err := rows.Scan(&a.ID, &a.Kind, &a.Title, &a.Body, &a.Audience, &a.TargetEmail, &a.CreatedAt, &a.Recipients); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}
