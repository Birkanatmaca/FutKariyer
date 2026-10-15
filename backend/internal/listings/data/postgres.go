package data

import (
	"context"
	"database/sql"
	"errors"

	"futcareer/backend/internal/listings/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

const columns = `l.id,l.club_user_id,u.full_name,c.district,c.football_type,l.title,l.position,l.description,l.status,l.created_at,l.closed_at`
const joins = ` FROM club_listings l JOIN users u ON u.id=l.club_user_id JOIN clubs c ON c.user_id=u.id`

type scanner interface{ Scan(...any) error }

func scan(row scanner) (domain.Listing, error) {
	var l domain.Listing
	var closed sql.NullTime
	err := row.Scan(&l.ID, &l.ClubID, &l.ClubName, &l.District, &l.FootballType, &l.Title, &l.Position, &l.Description, &l.Status, &l.CreatedAt, &closed)
	if errors.Is(err, sql.ErrNoRows) {
		return l, domain.ErrNotFound
	}
	if err != nil {
		return l, err
	}
	l.CreatedAt = l.CreatedAt.UTC()
	if closed.Valid {
		at := closed.Time.UTC()
		l.ClosedAt = &at
	}
	return l, nil
}

// Create publishes a listing and, in the same transaction, sends an
// opportunity notification to active players of the club's football type.
func (r *Postgres) Create(ctx context.Context, in domain.Listing) (domain.Listing, int, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return in, 0, err
	}
	defer tx.Rollback()
	// Locking the club serialises listing creation so the open-listing cap holds.
	var footballType, name string
	err = tx.QueryRowContext(ctx, `SELECT c.football_type,u.full_name FROM users u JOIN clubs c ON c.user_id=u.id WHERE u.id=$1 AND u.active AND u.role='club' FOR UPDATE OF u`, in.ClubID).Scan(&footballType, &name)
	if errors.Is(err, sql.ErrNoRows) {
		return in, 0, domain.ErrNotFound
	}
	if err != nil {
		return in, 0, err
	}
	var open int
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM club_listings WHERE club_user_id=$1 AND status='open'`, in.ClubID).Scan(&open); err != nil {
		return in, 0, err
	}
	if open >= domain.MaxOpenPerClub {
		return in, 0, domain.ErrTooManyOpen
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO club_listings(id,club_user_id,title,position,description) VALUES($1,$2,$3,$4,$5)`, in.ID, in.ClubID, in.Title, in.Position, in.Description); err != nil {
		return in, 0, err
	}
	notified := int64(0)
	if footballType != "unknown" {
		body := name + " yeni bir ilan yayınladı."
		if in.Position != "" {
			body = name + " " + in.Position + " arıyor. İlanı inceleyip başvurabilirsin."
		}
		res, err := tx.ExecContext(ctx, `INSERT INTO notifications(id,recipient_id,kind,title,body,resource_id,source_key)
			SELECT md5(random()::text || clock_timestamp()::text || u.id), u.id, 'opportunity', $2, $3, $1, 'listing:' || $1
			FROM users u JOIN player_profiles p ON p.user_id=u.id
			WHERE u.active AND u.role='player' AND p.football_type=$4`, in.ID, in.Title, body, footballType)
		if err != nil {
			return in, 0, err
		}
		if notified, err = res.RowsAffected(); err != nil {
			return in, 0, err
		}
	}
	out, err := scan(tx.QueryRowContext(ctx, `SELECT `+columns+joins+` WHERE l.id=$1`, in.ID))
	if err != nil {
		return out, 0, err
	}
	zero := 0
	out.Applications = &zero
	return out, int(notified), tx.Commit()
}

func (r *Postgres) Mine(ctx context.Context, clubID string) ([]domain.Listing, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+columns+`,(SELECT count(*) FROM team_join_requests q WHERE q.listing_id=l.id)`+joins+` WHERE l.club_user_id=$1 ORDER BY l.status='open' DESC,l.created_at DESC LIMIT 100`, clubID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Listing{}
	for rows.Next() {
		var l domain.Listing
		var closed sql.NullTime
		var count int
		if err := rows.Scan(&l.ID, &l.ClubID, &l.ClubName, &l.District, &l.FootballType, &l.Title, &l.Position, &l.Description, &l.Status, &l.CreatedAt, &closed, &count); err != nil {
			return nil, err
		}
		l.CreatedAt = l.CreatedAt.UTC()
		if closed.Valid {
			at := closed.Time.UTC()
			l.ClosedAt = &at
		}
		l.Applications = &count
		out = append(out, l)
	}
	return out, rows.Err()
}

func (r *Postgres) Close(ctx context.Context, clubID, id string) (domain.Listing, error) {
	if _, err := r.db.ExecContext(ctx, `UPDATE club_listings SET status='closed',closed_at=clock_timestamp() WHERE id=$1 AND club_user_id=$2 AND status='open'`, id, clubID); err != nil {
		return domain.Listing{}, err
	}
	return scan(r.db.QueryRowContext(ctx, `SELECT `+columns+joins+` WHERE l.id=$1 AND l.club_user_id=$2`, id, clubID))
}

// Open lists open listings of active clubs, newest first, optionally for one football type.
func (r *Postgres) Open(ctx context.Context, footballType string, page int) (domain.Page, error) {
	const size = 20
	out := domain.Page{Items: []domain.Listing{}, Page: page, PageSize: size}
	where := ` WHERE l.status='open' AND u.active AND ($1='' OR c.football_type=$1)`
	if err := r.db.QueryRowContext(ctx, `SELECT count(*)`+joins+where, footballType).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT `+columns+joins+where+` ORDER BY l.created_at DESC,l.id DESC LIMIT $2 OFFSET $3`, footballType, size, (page-1)*size)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		l, err := scan(rows)
		if err != nil {
			return out, err
		}
		out.Items = append(out.Items, l)
	}
	out.TotalPages = (out.Total + size - 1) / size
	return out, rows.Err()
}

// Get returns an open listing of an active club; closed listings are not public.
func (r *Postgres) Get(ctx context.Context, id string) (domain.Listing, error) {
	return scan(r.db.QueryRowContext(ctx, `SELECT `+columns+joins+` WHERE l.id=$1 AND l.status='open' AND u.active`, id))
}
