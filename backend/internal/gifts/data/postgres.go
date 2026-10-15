package data

import (
	"context"
	"database/sql"
	"errors"
	"time"

	auth "futcareer/backend/internal/auth/application"
	gamedomain "futcareer/backend/internal/games/domain"
	"futcareer/backend/internal/gifts/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

func (r *Postgres) CreateGift(ctx context.Context, g domain.Gift, email string) (domain.Gift, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return g, err
	}
	defer tx.Rollback()
	var target sql.NullString
	var role string
	if g.Audience == domain.AudienceAccount {
		err = tx.QueryRowContext(ctx, `SELECT id,role FROM users WHERE lower(email)=$1 AND active AND role IN ('player','club','coach')`, email).Scan(&target.String, &role)
		if errors.Is(err, sql.ErrNoRows) {
			return g, auth.ValidationError{"email": "Bu e-posta ile aktif bir hesap bulunamadı."}
		}
		if err != nil {
			return g, err
		}
		target.Valid = true
		if g.Kind == domain.KindApplicationRight && role != "player" {
			return g, auth.ValidationError{"kind": "Başvuru hakkı yalnızca oyuncu hesaplarına verilebilir."}
		}
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO gifts(id,kind,title,message,audience,target_user_id,validity_days) VALUES($1,$2,$3,$4,$5,$6,$7)`,
		g.ID, g.Kind, g.Title, g.Message, g.Audience, nullable(target), g.ValidityDays); err != nil {
		return g, err
	}
	// The database picks recipients inside the same transaction, so a campaign
	// reaches exactly the accounts that are active at send time.
	res, err := tx.ExecContext(ctx, `INSERT INTO user_gifts(id,gift_id,user_id,created_at,expires_at)
		SELECT md5(random()::text || clock_timestamp()::text || u.id), $1, u.id, clock_timestamp(), clock_timestamp() + make_interval(days => $2)
		FROM users u
		WHERE u.active AND u.role IN ('player','club','coach')
		  AND ($3::text IS NULL OR u.id = $3)
		  AND ($4 <> 'application_right' OR u.role = 'player')`,
		g.ID, g.ValidityDays, nullable(target), g.Kind)
	if err != nil {
		return g, err
	}
	count, err := res.RowsAffected()
	if err != nil {
		return g, err
	}
	if count == 0 {
		return g, domain.ErrNoRecipient
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO notifications(id,recipient_id,kind,title,body,resource_id,source_key)
		SELECT md5(random()::text || clock_timestamp()::text || ug.user_id), ug.user_id, 'gift', 'Yeni bir hediyen var', $2 || ' hediyesi hesabına gönderildi. Hediyelerim ekranından alabilirsin.', $1, 'gift:' || $1
		FROM user_gifts ug WHERE ug.gift_id=$1`, g.ID, g.Title); err != nil {
		return g, err
	}
	if err = tx.Commit(); err != nil {
		return g, err
	}
	g.Recipients = int(count)
	return g, nil
}

func nullable(v sql.NullString) any {
	if !v.Valid {
		return nil
	}
	return v.String
}

func (r *Postgres) ListGifts(ctx context.Context) ([]domain.Gift, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT g.id,g.kind,g.title,g.message,g.audience,COALESCE(u.email,''),g.validity_days,g.created_at,
		count(ug.id),count(ug.claimed_at)
		FROM gifts g
		LEFT JOIN users u ON u.id=g.target_user_id
		LEFT JOIN user_gifts ug ON ug.gift_id=g.id
		GROUP BY g.id,u.email
		ORDER BY g.created_at DESC,g.id DESC
		LIMIT 100`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Gift{}
	for rows.Next() {
		var g domain.Gift
		if err := rows.Scan(&g.ID, &g.Kind, &g.Title, &g.Message, &g.Audience, &g.TargetEmail, &g.ValidityDays, &g.CreatedAt, &g.Recipients, &g.Claimed); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func (r *Postgres) MyGifts(ctx context.Context, userID string) ([]domain.MyGift, time.Time, error) {
	var now time.Time
	if err := r.db.QueryRowContext(ctx, `SELECT clock_timestamp()`).Scan(&now); err != nil {
		return nil, now, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT ug.id,g.kind,g.title,g.message,ug.created_at,ug.expires_at,ug.claimed_at
		FROM user_gifts ug JOIN gifts g ON g.id=ug.gift_id
		WHERE ug.user_id=$1
		ORDER BY ug.created_at DESC,ug.id DESC
		LIMIT 100`, userID)
	if err != nil {
		return nil, now, err
	}
	defer rows.Close()
	out := []domain.MyGift{}
	for rows.Next() {
		var g domain.MyGift
		var claimed sql.NullTime
		if err := rows.Scan(&g.ID, &g.Kind, &g.Title, &g.Message, &g.CreatedAt, &g.ExpiresAt, &claimed); err != nil {
			return nil, now, err
		}
		if claimed.Valid {
			at := claimed.Time.UTC()
			g.ClaimedAt = &at
		}
		g.CreatedAt = g.CreatedAt.UTC()
		g.ExpiresAt = g.ExpiresAt.UTC()
		out = append(out, g)
	}
	return out, now.UTC(), rows.Err()
}

// Claim locks the account first, then the wallet, the same order games use,
// so a gift and a game action cannot both change the heart state at once.
func (r *Postgres) Claim(ctx context.Context, userID, userGiftID string) (domain.ClaimResult, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.ClaimResult{}, err
	}
	defer tx.Rollback()
	var role string
	err = tx.QueryRowContext(ctx, `SELECT role FROM users WHERE id=$1 AND active AND role IN ('player','club','coach') FOR UPDATE`, userID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ClaimResult{}, domain.ErrForbidden
	}
	if err != nil {
		return domain.ClaimResult{}, err
	}
	var now time.Time
	if err = tx.QueryRowContext(ctx, `SELECT clock_timestamp()`).Scan(&now); err != nil {
		return domain.ClaimResult{}, err
	}
	now = now.UTC()
	var g domain.MyGift
	var claimed sql.NullTime
	err = tx.QueryRowContext(ctx, `SELECT ug.id,g.kind,g.title,g.message,ug.created_at,ug.expires_at,ug.claimed_at
		FROM user_gifts ug JOIN gifts g ON g.id=ug.gift_id
		WHERE ug.id=$1 AND ug.user_id=$2 FOR UPDATE OF ug`, userGiftID, userID).
		Scan(&g.ID, &g.Kind, &g.Title, &g.Message, &g.CreatedAt, &g.ExpiresAt, &claimed)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ClaimResult{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.ClaimResult{}, err
	}
	g.CreatedAt = g.CreatedAt.UTC()
	g.ExpiresAt = g.ExpiresAt.UTC()
	if claimed.Valid {
		at := claimed.Time.UTC()
		g.ClaimedAt = &at
		return domain.ClaimResult{Gift: g, AlreadyClaimed: true}, tx.Commit()
	}
	if !now.Before(g.ExpiresAt) {
		return domain.ClaimResult{}, domain.ErrExpired
	}
	switch g.Kind {
	case domain.KindHeartOne:
		err = grantHearts(ctx, tx, userID, 1, now)
	case domain.KindHeartFull:
		err = grantHearts(ctx, tx, userID, gamedomain.MaxHearts, now)
	case domain.KindApplicationRight:
		if role != "player" {
			return domain.ClaimResult{}, domain.ErrKindRole
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO team_request_gift_rewards(user_gift_id,player_id) VALUES($1,$2)`, userGiftID, userID)
	default:
		return domain.ClaimResult{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.ClaimResult{}, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE user_gifts SET claimed_at=$2 WHERE id=$1`, userGiftID, now); err != nil {
		return domain.ClaimResult{}, err
	}
	g.ClaimedAt = &now
	return domain.ClaimResult{Gift: g}, tx.Commit()
}

func grantHearts(ctx context.Context, tx *sql.Tx, userID string, hearts int, now time.Time) error {
	if _, err := tx.ExecContext(ctx, `INSERT INTO game_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`, userID); err != nil {
		return err
	}
	var wallet gamedomain.Wallet
	var anchor sql.NullTime
	if err := tx.QueryRowContext(ctx, `SELECT hearts,refill_anchor FROM game_wallets WHERE user_id=$1 FOR UPDATE`, userID).Scan(&wallet.Hearts, &anchor); err != nil {
		return err
	}
	if anchor.Valid {
		at := anchor.Time.UTC()
		wallet.RefillAnchor = &at
	}
	wallet = wallet.Grant(hearts, now)
	_, err := tx.ExecContext(ctx, `UPDATE game_wallets SET hearts=$2,refill_anchor=$3 WHERE user_id=$1`, userID, wallet.Hearts, wallet.RefillAnchor)
	return err
}
