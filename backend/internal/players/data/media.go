package data

import (
	"context"
	"database/sql"
	"errors"

	moderation "futcareer/backend/internal/moderation/data"
	"futcareer/backend/internal/platform/media"
	"futcareer/backend/internal/players/domain"
)

var _ domain.MediaRepository = (*Postgres)(nil)

// galleryVisible: viewer $1 may see owner $2's gallery. The owner always can;
// others follow discovery (an active player who opened their profile, seen by
// a player or a verified club/coach) and must not be blocked either way.
var galleryVisible = `EXISTS(SELECT 1 FROM users o LEFT JOIN player_profiles pp ON pp.user_id=o.id
	WHERE o.id=$2 AND o.active AND o.role='player' AND ($1=$2 OR (COALESCE(pp.discoverable,false)
		AND EXISTS(SELECT 1 FROM users v WHERE v.id=$1 AND v.active AND (v.role='player' OR (v.role IN ('club','coach') AND v.verified)))
		AND ` + moderation.NotBlocked("$1", "$2") + `)))`

const mediaColumns = `id,owner_id,kind,mime,size,width,height,created_at`

func scanMedia(row interface{ Scan(...any) error }) (domain.MediaItem, error) {
	var item domain.MediaItem
	err := row.Scan(&item.ID, &item.OwnerID, &item.Kind, &item.MIME, &item.Size, &item.Width, &item.Height, &item.CreatedAt)
	item.CreatedAt = item.CreatedAt.UTC()
	return item, err
}

func (r *Postgres) VisibleMedia(ctx context.Context, viewerID, ownerID string) ([]domain.MediaItem, error) {
	var visible bool
	if err := r.db.QueryRowContext(ctx, `SELECT `+galleryVisible, viewerID, ownerID).Scan(&visible); err != nil {
		return nil, err
	}
	if !visible {
		return nil, domain.ErrMediaNotFound
	}
	rows, err := r.db.QueryContext(ctx, `SELECT `+mediaColumns+` FROM player_media WHERE owner_id=$1 ORDER BY created_at DESC,id DESC`, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.MediaItem{}
	for rows.Next() {
		item, err := scanMedia(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Postgres) AddMedia(ctx context.Context, ownerID, id string, file media.File) (domain.MediaItem, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.MediaItem{}, err
	}
	defer tx.Rollback()
	// Locking the owner keeps the gallery limit under concurrent uploads.
	var role string
	var active bool
	err = tx.QueryRowContext(ctx, `SELECT role,active FROM users WHERE id=$1 FOR UPDATE`, ownerID).Scan(&role, &active)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && (role != "player" || !active)) {
		return domain.MediaItem{}, domain.ErrMediaNotFound
	}
	if err != nil {
		return domain.MediaItem{}, err
	}
	var count int
	if err := tx.QueryRowContext(ctx, `SELECT count(*) FROM player_media WHERE owner_id=$1 AND kind=$2`, ownerID, file.Kind).Scan(&count); err != nil {
		return domain.MediaItem{}, err
	}
	if (file.Kind == "image" && count >= domain.MaxPhotos) || (file.Kind == "video" && count >= domain.MaxVideos) {
		return domain.MediaItem{}, domain.ErrMediaLimit
	}
	item, err := scanMedia(tx.QueryRowContext(ctx, `INSERT INTO player_media(id,owner_id,kind,mime,size,width,height,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING `+mediaColumns,
		id, ownerID, file.Kind, file.MIME, file.Size, file.Width, file.Height, file.Data))
	if err != nil {
		return domain.MediaItem{}, err
	}
	return item, tx.Commit()
}

func (r *Postgres) DeleteMedia(ctx context.Context, ownerID, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM player_media WHERE id=$1 AND owner_id=$2`, id, ownerID)
	if err != nil {
		return err
	}
	if count, err := result.RowsAffected(); err != nil || count != 1 {
		if err == nil {
			err = domain.ErrMediaNotFound
		}
		return err
	}
	return nil
}

func (r *Postgres) MediaFile(ctx context.Context, viewerID, ownerID, id string) (domain.MediaItem, []byte, error) {
	var item domain.MediaItem
	var data []byte
	err := r.db.QueryRowContext(ctx, `SELECT `+mediaColumns+`,data FROM player_media WHERE id=$3 AND owner_id=$2 AND `+galleryVisible, viewerID, ownerID, id).
		Scan(&item.ID, &item.OwnerID, &item.Kind, &item.MIME, &item.Size, &item.Width, &item.Height, &item.CreatedAt, &data)
	if errors.Is(err, sql.ErrNoRows) {
		return item, nil, domain.ErrMediaNotFound
	}
	item.CreatedAt = item.CreatedAt.UTC()
	return item, data, err
}
