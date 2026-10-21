package data

import (
	"context"
	"database/sql"
	"errors"

	"futcareer/backend/internal/content/domain"
)

// Admin rows carry how often a popup was shown and to how many accounts.
const popupColumns = `id,title,image_id,format,active,interval_minutes,max_views,starts_at,ends_at,
	COALESCE((SELECT sum(views) FROM popup_ad_views WHERE popup_id=popup_ads.id),0),
	(SELECT count(*) FROM popup_ad_views WHERE popup_id=popup_ads.id),
	created_at,updated_at`

func popup(row scanner) (domain.Popup, error) {
	var out domain.Popup
	err := row.Scan(&out.ID, &out.Title, &out.ImageID, &out.Format, &out.Active, &out.IntervalMinutes, &out.MaxViews, &out.StartsAt, &out.EndsAt, &out.Views, &out.Viewers, &out.CreatedAt, &out.UpdatedAt)
	return out, found(err)
}

func (r *Postgres) Popups(ctx context.Context, page int) (domain.Page[domain.Popup], error) {
	out := domain.Page[domain.Popup]{Items: []domain.Popup{}, Page: page, PageSize: 20}
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return out, err
	}
	defer tx.Rollback()
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM popup_ads`).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := tx.QueryContext(ctx, `SELECT `+popupColumns+` FROM popup_ads ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET $1`, (page-1)*20)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		value, e := popup(rows)
		if e != nil {
			return out, e
		}
		out.Items = append(out.Items, value)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if err = rows.Close(); err != nil {
		return out, err
	}
	out.TotalPages = (out.Total + 19) / 20
	return out, tx.Commit()
}

func (r *Postgres) SavePopup(ctx context.Context, in domain.Popup, create bool) (domain.Popup, error) {
	if create {
		return popup(r.db.QueryRowContext(ctx, `INSERT INTO popup_ads(id,title,image_id,format,active,interval_minutes,max_views,starts_at,ends_at)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING `+popupColumns,
			in.ID, in.Title, in.ImageID, in.Format, in.Active, in.IntervalMinutes, in.MaxViews, in.StartsAt, in.EndsAt))
	}
	return popup(r.db.QueryRowContext(ctx, `UPDATE popup_ads SET title=$2,image_id=$3,format=$4,active=$5,interval_minutes=$6,max_views=$7,starts_at=$8,ends_at=$9,updated_at=now()
		WHERE id=$1 RETURNING `+popupColumns,
		in.ID, in.Title, in.ImageID, in.Format, in.Active, in.IntervalMinutes, in.MaxViews, in.StartsAt, in.EndsAt))
}

func (r *Postgres) DeletePopup(ctx context.Context, id string) error {
	return r.delete(ctx, "popup_ads", id)
}

// A popup is due for an account that has not seen it yet, or saw it fewer
// times than the cap and longer ago than the interval.
const popupDue = `p.active AND (p.starts_at IS NULL OR p.starts_at<=now()) AND (p.ends_at IS NULL OR p.ends_at>now()) AND (v.popup_id IS NULL OR (v.views < p.max_views AND v.last_seen_at <= now() - make_interval(mins => p.interval_minutes)))`

func (r *Postgres) NextPopup(ctx context.Context, userID string) (domain.ShownPopup, bool, error) {
	var out domain.ShownPopup
	err := r.db.QueryRowContext(ctx, `SELECT p.id,p.image_id,p.format FROM popup_ads p
		LEFT JOIN popup_ad_views v ON v.popup_id=p.id AND v.user_id=$1
		WHERE `+popupDue+` ORDER BY p.updated_at DESC,p.id LIMIT 1`, userID).Scan(&out.ID, &out.ImageID, &out.Format)
	if errors.Is(err, sql.ErrNoRows) {
		return out, false, nil
	}
	return out, err == nil, err
}

func (r *Postgres) RecordPopupView(ctx context.Context, popupID, userID string) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO popup_ad_views(popup_id,user_id,views,last_seen_at)
		SELECT p.id,$2,1,now() FROM popup_ads p WHERE p.id=$1 AND p.active
		ON CONFLICT (popup_id,user_id) DO UPDATE SET views=popup_ad_views.views+1,last_seen_at=now()
		WHERE EXISTS(SELECT 1 FROM popup_ads p WHERE p.id=popup_ad_views.popup_id AND p.active
			AND popup_ad_views.views < p.max_views
			AND popup_ad_views.last_seen_at <= now() - make_interval(mins => p.interval_minutes))`, popupID, userID)
	return err
}
