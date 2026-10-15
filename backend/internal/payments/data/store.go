package data

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"futcareer/backend/internal/payments/domain"
)

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// SetOrderProvider binds a fresh pending order to the store that will charge it.
func (r *Postgres) SetOrderProvider(ctx context.Context, orderID, provider string) error {
	result, err := r.db.ExecContext(ctx, `UPDATE team_request_payments SET provider=$2,updated_at=now() WHERE id=$1 AND status='pending' AND provider=''`, orderID, provider)
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count != 1 {
		return domain.ErrNotFound
	}
	return nil
}

// StoreOrder returns an order with its item's product id in the order's store.
func (r *Postgres) StoreOrder(ctx context.Context, orderID string) (domain.StoreOrderInfo, error) {
	var info domain.StoreOrderInfo
	err := r.db.QueryRowContext(ctx, `SELECT p.id,p.provider,p.status,COALESCE(CASE p.provider
		WHEN 'app_store' THEN COALESCE(k.apple_product_id,pl.apple_product_id)
		WHEN 'google_play' THEN COALESCE(k.google_product_id,pl.google_product_id) END,'')
		FROM team_request_payments p
		LEFT JOIN team_request_packages k ON p.product='team_rights' AND k.id=p.package_id
		LEFT JOIN pro_plans pl ON p.product='pro' AND pl.id=p.pro_plan_id
		WHERE p.id=$1`, orderID).Scan(&info.ID, &info.Provider, &info.Status, &info.ProductID)
	if errors.Is(err, sql.ErrNoRows) {
		return info, domain.ErrNotFound
	}
	return info, err
}

func (r *Postgres) OrderByProviderPayment(ctx context.Context, provider, paymentID string) (string, error) {
	var id string
	err := r.db.QueryRowContext(ctx, `SELECT id FROM team_request_payments WHERE provider=$1 AND provider_payment_id=$2`, provider, paymentID).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return "", domain.ErrNotFound
	}
	return id, err
}

func (r *Postgres) SyncCursor(ctx context.Context, name string) (time.Time, bool, error) {
	var position time.Time
	err := r.db.QueryRowContext(ctx, `SELECT position FROM store_sync_cursors WHERE name=$1`, name).Scan(&position)
	if errors.Is(err, sql.ErrNoRows) {
		return time.Time{}, false, nil
	}
	return position.UTC(), err == nil, err
}

func (r *Postgres) SetSyncCursor(ctx context.Context, name string, position time.Time) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO store_sync_cursors(name,position) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET position=GREATEST(store_sync_cursors.position,EXCLUDED.position),updated_at=now()`, name, position)
	return err
}
