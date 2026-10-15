package data

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"strings"

	notificationsdata "futcareer/backend/internal/notifications/data"
	notificationsdomain "futcareer/backend/internal/notifications/domain"
	"futcareer/backend/internal/payments/domain"
	prodata "futcareer/backend/internal/pro/data"
	prodomain "futcareer/backend/internal/pro/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

func (r *Postgres) ListPackages(ctx context.Context, includeInactive bool) ([]domain.Package, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id,credits,amount_minor,currency,active,sort_order FROM team_request_packages WHERE ($1 OR active) ORDER BY sort_order,credits`, includeInactive)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []domain.Package{}
	for rows.Next() {
		var item domain.Package
		if err := rows.Scan(&item.ID, &item.Credits, &item.AmountMinor, &item.Currency, &item.Active, &item.SortOrder); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Postgres) UpdatePackage(ctx context.Context, id string, amountMinor int64, active bool) (domain.Package, error) {
	var item domain.Package
	err := r.db.QueryRowContext(ctx, `UPDATE team_request_packages SET amount_minor=$2,active=$3,updated_at=now() WHERE id=$1 RETURNING id,credits,amount_minor,currency,active,sort_order`, id, amountMinor, active).Scan(&item.ID, &item.Credits, &item.AmountMinor, &item.Currency, &item.Active, &item.SortOrder)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Package{}, domain.ErrNotFound
	}
	return item, err
}

func (r *Postgres) ListPayments(ctx context.Context, query domain.Query) (domain.Page, error) {
	out := domain.Page{Items: []domain.Payment{}, Page: query.Page, PageSize: query.PageSize}
	search := strings.ToLower(query.Search)
	filter := `($1='all' OR p.status=$1) AND ($2='' OR strpos(lower(COALESCE(u.full_name,'')),$2)>0 OR strpos(lower(COALESCE(u.email,'')),$2)>0 OR strpos(lower(p.id),$2)>0)`
	if err := r.db.QueryRowContext(ctx, `SELECT count(*) FROM team_request_payments p LEFT JOIN users u ON u.id=p.player_id WHERE `+filter, query.Status, search).Scan(&out.Total); err != nil {
		return out, err
	}
	if err := r.db.QueryRowContext(ctx, `SELECT count(*),count(*) FILTER (WHERE status='pending'),count(*) FILTER (WHERE status='paid'),count(*) FILTER (WHERE status='failed'),count(*) FILTER (WHERE status='refunded'),COALESCE(sum(amount_minor) FILTER (WHERE status='paid'),0),COALESCE(sum(amount_minor) FILTER (WHERE status='refunded'),0) FROM team_request_payments`).Scan(&out.Summary.Total, &out.Summary.Pending, &out.Summary.Paid, &out.Summary.Failed, &out.Summary.Refunded, &out.Summary.CollectedMinor, &out.Summary.RefundedMinor); err != nil {
		return out, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT p.id,p.product,COALESCE(p.player_id,''),COALESCE(u.full_name,''),COALESCE(u.email,''),COALESCE(p.package_id,''),p.package_credits,p.amount_minor,p.currency,p.provider,COALESCE(p.provider_payment_id,''),p.status,p.created_at,p.updated_at,p.confirmed_at FROM team_request_payments p LEFT JOIN users u ON u.id=p.player_id WHERE `+filter+` ORDER BY p.created_at DESC,p.id DESC LIMIT $3 OFFSET $4`, query.Status, search, query.PageSize, (query.Page-1)*query.PageSize)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var item domain.Payment
		var confirmedAt sql.NullTime
		if err := rows.Scan(&item.ID, &item.Product, &item.PlayerID, &item.PlayerName, &item.PlayerEmail, &item.PackageID, &item.PackageCredits, &item.AmountMinor, &item.Currency, &item.Provider, &item.ProviderPaymentID, &item.Status, &item.CreatedAt, &item.UpdatedAt, &confirmedAt); err != nil {
			return out, err
		}
		item.CreatedAt, item.UpdatedAt = item.CreatedAt.UTC(), item.UpdatedAt.UTC()
		if confirmedAt.Valid {
			value := confirmedAt.Time.UTC()
			item.ConfirmedAt = &value
		}
		out.Items = append(out.Items, item)
	}
	if err := rows.Err(); err != nil {
		return out, err
	}
	if err := rows.Close(); err != nil {
		return out, err
	}
	out.TotalPages = (out.Total + query.PageSize - 1) / query.PageSize
	return out, nil
}

func (r *Postgres) CreateOrder(ctx context.Context, playerID, packageID, orderID string) (domain.Order, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Order{}, err
	}
	defer tx.Rollback()
	var role string
	var active bool
	err = tx.QueryRowContext(ctx, `SELECT role,active FROM users WHERE id=$1 FOR UPDATE`, playerID).Scan(&role, &active)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Order{}, domain.ErrForbidden
	}
	if err != nil {
		return domain.Order{}, err
	}
	if role != "player" || !active {
		return domain.Order{}, domain.ErrForbidden
	}
	var order domain.Order
	order.ID, order.Product, order.PlayerID, order.PackageID, order.Status = orderID, domain.ProductTeamRights, playerID, packageID, "pending"
	err = tx.QueryRowContext(ctx, `SELECT credits,amount_minor,currency FROM team_request_packages WHERE id=$1 AND active FOR SHARE`, packageID).Scan(&order.PackageCredits, &order.AmountMinor, &order.Currency)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Order{}, domain.ErrPackageUnavailable
	}
	if err != nil {
		return domain.Order{}, err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO team_request_payments(id,player_id,package_id,package_credits,amount_minor,currency,status) VALUES($1,$2,$3,$4,$5,$6,'pending')`, order.ID, order.PlayerID, order.PackageID, order.PackageCredits, order.AmountMinor, order.Currency)
	if err != nil {
		return domain.Order{}, err
	}
	return order, tx.Commit()
}

const proPlanColumns = `id,days,bonus_credits,amount_minor,currency,active`

func scanProPlan(row interface{ Scan(...any) error }) (domain.ProPlan, error) {
	var plan domain.ProPlan
	err := row.Scan(&plan.ID, &plan.Days, &plan.BonusCredits, &plan.AmountMinor, &plan.Currency, &plan.Active)
	if errors.Is(err, sql.ErrNoRows) {
		return plan, domain.ErrNotFound
	}
	return plan, err
}

func (r *Postgres) ProPlan(ctx context.Context) (domain.ProPlan, error) {
	return scanProPlan(r.db.QueryRowContext(ctx, `SELECT `+proPlanColumns+` FROM pro_plans ORDER BY created_at,id LIMIT 1`))
}

func (r *Postgres) UpdateProPlan(ctx context.Context, id string, amountMinor int64, active bool) (domain.ProPlan, error) {
	return scanProPlan(r.db.QueryRowContext(ctx, `UPDATE pro_plans SET amount_minor=$2,active=$3,updated_at=now() WHERE id=$1 RETURNING `+proPlanColumns, id, amountMinor, active))
}

func (r *Postgres) CreateProOrder(ctx context.Context, userID, planID, orderID string) (domain.Order, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Order{}, err
	}
	defer tx.Rollback()
	var role string
	var active bool
	err = tx.QueryRowContext(ctx, `SELECT role,active FROM users WHERE id=$1 FOR UPDATE`, userID).Scan(&role, &active)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Order{}, domain.ErrForbidden
	}
	if err != nil {
		return domain.Order{}, err
	}
	if !prodomain.EligibleRole(role) || !active {
		return domain.Order{}, domain.ErrForbidden
	}
	order := domain.Order{ID: orderID, Product: domain.ProductPro, PlayerID: userID, Status: "pending"}
	err = tx.QueryRowContext(ctx, `SELECT amount_minor,currency FROM pro_plans WHERE id=$1 AND active FOR SHARE`, planID).Scan(&order.AmountMinor, &order.Currency)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Order{}, domain.ErrPackageUnavailable
	}
	if err != nil {
		return domain.Order{}, err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO team_request_payments(id,product,player_id,pro_plan_id,package_credits,amount_minor,currency,status) VALUES($1,'pro',$2,$3,0,$4,$5,'pending')`, order.ID, userID, planID, order.AmountMinor, order.Currency)
	if err != nil {
		return domain.Order{}, err
	}
	return order, tx.Commit()
}

func (r *Postgres) SetCheckout(ctx context.Context, orderID, provider, providerPaymentID string) error {
	result, err := r.db.ExecContext(ctx, `UPDATE team_request_payments SET provider=$2,provider_payment_id=$3,updated_at=now() WHERE id=$1 AND (provider='' OR provider=$2) AND (provider_payment_id IS NULL OR provider_payment_id=$3)`, orderID, provider, providerPaymentID)
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count != 1 {
		return domain.ErrInvalidEvent
	}
	return nil
}

func (r *Postgres) MarkOrderFailed(ctx context.Context, orderID string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE team_request_payments SET status='failed',updated_at=now() WHERE id=$1 AND status='pending'`, orderID)
	return err
}

func (r *Postgres) ApplyEvent(ctx context.Context, event domain.ProviderEvent) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var status, provider, paymentID, playerID, product string
	err = tx.QueryRowContext(ctx, `SELECT status,provider,COALESCE(provider_payment_id,''),COALESCE(player_id,''),product FROM team_request_payments WHERE id=$1 FOR UPDATE`, event.OrderID).Scan(&status, &provider, &paymentID, &playerID, &product)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ErrNotFound
	}
	if err != nil {
		return err
	}
	if (provider != "" && provider != event.Provider) || (paymentID != "" && paymentID != event.ProviderPaymentID) {
		return domain.ErrInvalidEvent
	}
	result, err := tx.ExecContext(ctx, `INSERT INTO team_request_payment_events(provider,event_id,order_id) VALUES($1,$2,$3) ON CONFLICT(provider,event_id) DO NOTHING`, event.Provider, event.EventID, event.OrderID)
	if err != nil {
		return err
	}
	inserted, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if inserted == 0 {
		return tx.Commit()
	}
	newStatus := status
	switch event.Status {
	case "paid":
		if status != "refunded" {
			newStatus = "paid"
		}
	case "failed":
		if status == "pending" {
			newStatus = "failed"
		}
	case "refunded":
		if status == "paid" {
			newStatus = "refunded"
		} else if status != "refunded" {
			return domain.ErrInvalidEvent
		}
	default:
		return domain.ErrInvalidEvent
	}
	_, err = tx.ExecContext(ctx, `UPDATE team_request_payments SET provider=$2,provider_payment_id=$3,status=$4,updated_at=now(),confirmed_at=CASE WHEN $4='paid' THEN COALESCE(confirmed_at,now()) ELSE confirmed_at END WHERE id=$1`, event.OrderID, event.Provider, event.ProviderPaymentID, newStatus)
	if err != nil {
		return err
	}
	if product == domain.ProductPro {
		if err = applyPro(ctx, tx, event.OrderID, playerID, status, newStatus); err != nil {
			return err
		}
	}
	if newStatus != status && playerID != "" {
		notification := notificationsdomain.NewPaymentStatus(playerID, event.OrderID, "payment-event:"+event.Provider+":"+event.EventID, newStatus)
		if product == domain.ProductPro {
			notification = notificationsdomain.NewProPaymentStatus(playerID, event.OrderID, "payment-event:"+event.Provider+":"+event.EventID, newStatus)
		}
		if err = notificationsdata.CreateInTx(ctx, tx, notification); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// applyPro activates one Pro period when an order first becomes paid (the unique
// payment id keeps it to once per order) and shortens it again on refund.
func applyPro(ctx context.Context, tx *sql.Tx, orderID, userID, from, to string) error {
	if userID == "" || from == to {
		return nil
	}
	if to == "refunded" {
		return prodata.RefundInTx(ctx, tx, orderID)
	}
	if to != "paid" {
		return nil
	}
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return err
	}
	_, err := prodata.ActivateInTx(ctx, tx, userID, "payment", orderID, hex.EncodeToString(value), prodomain.PeriodDays)
	if errors.Is(err, prodomain.ErrNotEligible) || errors.Is(err, prodomain.ErrNotFound) {
		// The payment stays recorded; an account that changed type cannot hold Pro.
		return nil
	}
	return err
}
