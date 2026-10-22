package data

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	notificationsdata "futcareer/backend/internal/notifications/data"
	notificationsdomain "futcareer/backend/internal/notifications/domain"
	"futcareer/backend/internal/teams/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

const teamColumns = `u.id,u.full_name AS name,c.football_type,COALESCE(c.district,'') AS district,c.description,c.venue_name,c.venue_address,c.training_ground_name,c.training_ground_address,c.training_schedule`
const teamFrom = ` FROM users u JOIN clubs c ON c.user_id=u.id`

func scanTeam(row interface{ Scan(...any) error }) (domain.Team, error) {
	var value domain.Team
	err := row.Scan(&value.ID, &value.Name, &value.FootballType, &value.District, &value.Description, &value.VenueName, &value.VenueAddress, &value.TrainingGroundName, &value.TrainingGroundAddress, &value.TrainingSchedule)
	if errors.Is(err, sql.ErrNoRows) {
		return value, domain.ErrNotFound
	}
	return value, err
}

func (r *Postgres) List(ctx context.Context, query domain.Query) (domain.Page[domain.Team], error) {
	out := domain.Page[domain.Team]{Items: []domain.Team{}, Page: query.Page, PageSize: query.PageSize}
	countWhere := ` WHERE u.active AND u.role='club' AND ($1='' OR strpos(lower(u.full_name),$1)>0 OR strpos(lower(COALESCE(c.district,'')),$1)>0)`
	search := strings.ToLower(query.Search)
	if err := r.db.QueryRowContext(ctx, `SELECT count(*)`+teamFrom+countWhere, search).Scan(&out.Total); err != nil {
		return out, err
	}
	listWhere := ` WHERE u.active AND u.role='club' AND ($2='' OR strpos(lower(u.full_name),$2)>0 OR strpos(lower(COALESCE(c.district,'')),$2)>0)`
	rows, err := r.db.QueryContext(ctx, `SELECT id,name,football_type,district,description,venue_name,venue_address,training_ground_name,training_ground_address,training_schedule FROM (
		SELECT `+teamColumns+`,row_number() OVER(PARTITION BY c.football_type ORDER BY (c.football_type=(SELECT football_type FROM player_profiles WHERE user_id=$1)) DESC,lower(u.full_name),u.id) AS team_rank`+teamFrom+listWhere+`
	) ranked ORDER BY team_rank, (football_type=(SELECT football_type FROM player_profiles WHERE user_id=$1)) DESC,lower(name),id LIMIT $3 OFFSET $4`, query.ViewerID, search, query.PageSize, (query.Page-1)*query.PageSize)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		item, scanErr := scanTeam(rows)
		if scanErr != nil {
			return out, scanErr
		}
		out.Items = append(out.Items, item)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if err = rows.Close(); err != nil {
		return out, err
	}
	out.TotalPages = (out.Total + query.PageSize - 1) / query.PageSize
	return out, nil
}

func (r *Postgres) Get(ctx context.Context, id string) (domain.Team, error) {
	return scanTeam(r.db.QueryRowContext(ctx, `SELECT `+teamColumns+teamFrom+` WHERE u.active AND u.role='club' AND u.id=$1`, id))
}

func (r *Postgres) RequestStatus(ctx context.Context, playerID, clubID string) (string, error) {
	var status string
	err := r.db.QueryRowContext(ctx, `SELECT status FROM team_join_requests WHERE player_id=$1 AND club_user_id=$2`, playerID, clubID).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return status, err
}

func (r *Postgres) Quota(ctx context.Context, playerID string) (domain.Quota, error) {
	return readQuota(ctx, r.db, playerID)
}

type quotaQuery interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func readQuota(ctx context.Context, q quotaQuery, playerID string) (domain.Quota, error) {
	var used, purchased, earned, pro int
	err := q.QueryRowContext(ctx, `SELECT
	 (SELECT count(*) FROM team_join_requests WHERE player_id=$1),
	 (SELECT COALESCE(sum(package_credits),0) FROM team_request_payments WHERE player_id=$1 AND status='paid' AND product='team_rights'),
	 (SELECT COALESCE(sum(credits),0) FROM team_request_game_rewards WHERE player_id=$1)+(SELECT count(*) FROM team_request_penalty_rewards WHERE player_id=$1)+(SELECT count(*) FROM team_request_gift_rewards WHERE player_id=$1),
	 (SELECT COALESCE(sum(pp.bonus_credits),0) FROM pro_periods pp LEFT JOIN team_request_payments t ON t.id=pp.payment_id
		WHERE pp.user_id=$1 AND (pp.payment_id IS NULL OR t.status='paid'))`, playerID).Scan(&used, &purchased, &earned, &pro)
	return domain.NewQuota(used, purchased, earned, pro), err
}

func (r *Postgres) PlayerRequests(ctx context.Context, playerID string, page, pageSize int) (domain.Page[domain.TeamApplication], domain.Quota, error) {
	out := domain.Page[domain.TeamApplication]{Items: []domain.TeamApplication{}, Page: page, PageSize: pageSize}
	quota := domain.Quota{}
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return out, quota, err
	}
	defer tx.Rollback()
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM team_join_requests WHERE player_id=$1`, playerID).Scan(&out.Total); err != nil {
		return out, quota, err
	}
	quota, err = readQuota(ctx, tx, playerID)
	if err != nil {
		return out, quota, err
	}
	rows, err := tx.QueryContext(ctx, `SELECT q.id,q.club_user_id,COALESCE(u.full_name,''),COALESCE(c.district,''),COALESCE(u.active,false),q.status,q.created_at,q.updated_at FROM team_join_requests q LEFT JOIN users u ON u.id=q.club_user_id AND u.role='club' LEFT JOIN clubs c ON c.user_id=u.id WHERE q.player_id=$1 ORDER BY q.created_at DESC,q.id DESC LIMIT $2 OFFSET $3`, playerID, pageSize, (page-1)*pageSize)
	if err != nil {
		return out, quota, err
	}
	defer rows.Close()
	for rows.Next() {
		var item domain.TeamApplication
		if err = rows.Scan(&item.ID, &item.TeamID, &item.TeamName, &item.TeamDistrict, &item.TeamAvailable, &item.Status, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return out, quota, err
		}
		item.CreatedAt, item.UpdatedAt = item.CreatedAt.UTC(), item.UpdatedAt.UTC()
		if item.TeamName == "" {
			item.TeamName = "Takım artık mevcut değil"
		}
		out.Items = append(out.Items, item)
	}
	if err = rows.Err(); err != nil {
		return out, quota, err
	}
	if err = rows.Close(); err != nil {
		return out, quota, err
	}
	out.TotalPages = (out.Total + pageSize - 1) / pageSize
	if err = tx.Commit(); err != nil {
		return out, quota, err
	}
	return out, quota, nil
}

func (r *Postgres) CreateRequest(ctx context.Context, playerID, clubID, requestID, listingID string) (domain.JoinRequest, domain.Quota, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.JoinRequest{}, domain.Quota{}, err
	}
	defer tx.Rollback()
	var role string
	var active bool
	err = tx.QueryRowContext(ctx, `SELECT role,active FROM users WHERE id=$1 FOR UPDATE`, playerID).Scan(&role, &active)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.JoinRequest{}, domain.Quota{}, domain.ErrForbidden
	}
	if err != nil {
		return domain.JoinRequest{}, domain.Quota{}, err
	}
	if !active || role != "player" {
		return domain.JoinRequest{}, domain.Quota{}, domain.ErrForbidden
	}
	var clubActive bool
	err = tx.QueryRowContext(ctx, `SELECT u.active FROM users u JOIN clubs c ON c.user_id=u.id WHERE u.id=$1 AND u.role='club' FOR SHARE OF u`, clubID).Scan(&clubActive)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.JoinRequest{}, domain.Quota{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.JoinRequest{}, domain.Quota{}, err
	}
	if !clubActive {
		return domain.JoinRequest{}, domain.Quota{}, domain.ErrNotFound
	}
	var existing bool
	if err = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM team_join_requests WHERE player_id=$1 AND club_user_id=$2)`, playerID, clubID).Scan(&existing); err != nil {
		return domain.JoinRequest{}, domain.Quota{}, err
	}
	if existing {
		return domain.JoinRequest{}, domain.Quota{}, domain.ErrDuplicate
	}
	if listingID != "" {
		var open bool
		err = tx.QueryRowContext(ctx, `SELECT status='open' FROM club_listings WHERE id=$1 AND club_user_id=$2 FOR SHARE`, listingID, clubID).Scan(&open)
		if errors.Is(err, sql.ErrNoRows) || (err == nil && !open) {
			return domain.JoinRequest{}, domain.Quota{}, domain.ErrNotFound
		}
		if err != nil {
			return domain.JoinRequest{}, domain.Quota{}, err
		}
	}
	quota, err := readQuota(ctx, tx, playerID)
	if err != nil {
		return domain.JoinRequest{}, domain.Quota{}, err
	}
	if quota.Remaining <= 0 {
		return domain.JoinRequest{}, quota, domain.ErrQuotaExhausted
	}
	request := domain.JoinRequest{ID: requestID, PlayerID: playerID, ClubID: clubID, Status: "pending"}
	err = tx.QueryRowContext(ctx, `INSERT INTO team_join_requests(id,player_id,club_user_id,listing_id) VALUES($1,$2,$3,NULLIF($4,'')) RETURNING created_at,updated_at`, requestID, playerID, clubID, listingID).Scan(&request.CreatedAt, &request.UpdatedAt)
	if err != nil {
		return domain.JoinRequest{}, domain.Quota{}, err
	}
	request.CreatedAt = request.CreatedAt.UTC()
	request.UpdatedAt = request.UpdatedAt.UTC()
	if err = notificationsdata.CreateInTx(ctx, tx, notificationsdomain.NewTeamApplicationReceived(clubID, requestID, playerID)); err != nil {
		return domain.JoinRequest{}, domain.Quota{}, err
	}
	quota = domain.NewQuota(quota.Used+1, quota.Purchased, quota.Earned, quota.Pro)
	return request, quota, tx.Commit()
}

func (r *Postgres) ListRequests(ctx context.Context, clubID, status string, page, pageSize int) (domain.Page[domain.JoinRequest], error) {
	out := domain.Page[domain.JoinRequest]{Items: []domain.JoinRequest{}, Page: page, PageSize: pageSize}
	where := ` WHERE q.club_user_id=$1 AND ($2='all' OR q.status=$2)`
	if err := r.db.QueryRowContext(ctx, `SELECT count(*) FROM team_join_requests q`+where, clubID, status).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT q.id,q.player_id,p.full_name,q.club_user_id,q.status,q.created_at,q.updated_at FROM team_join_requests q JOIN users p ON p.id=q.player_id WHERE q.club_user_id=$1 AND ($2='all' OR q.status=$2) ORDER BY q.created_at DESC,q.id DESC LIMIT $3 OFFSET $4`, clubID, status, pageSize, (page-1)*pageSize)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var item domain.JoinRequest
		if err = rows.Scan(&item.ID, &item.PlayerID, &item.PlayerName, &item.ClubID, &item.Status, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return out, err
		}
		item.CreatedAt, item.UpdatedAt = item.CreatedAt.UTC(), item.UpdatedAt.UTC()
		out.Items = append(out.Items, item)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if err = rows.Close(); err != nil {
		return out, err
	}
	out.TotalPages = (out.Total + pageSize - 1) / pageSize
	return out, nil
}

func (r *Postgres) DecideRequest(ctx context.Context, clubID, requestID, decision string) (domain.JoinRequest, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.JoinRequest{}, err
	}
	defer tx.Rollback()
	var role string
	var active bool
	err = tx.QueryRowContext(ctx, `SELECT role,active FROM users WHERE id=$1 FOR UPDATE`, clubID).Scan(&role, &active)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.JoinRequest{}, domain.ErrForbidden
	}
	if err != nil {
		return domain.JoinRequest{}, err
	}
	if !active || role != "club" {
		return domain.JoinRequest{}, domain.ErrForbidden
	}
	var status string
	err = tx.QueryRowContext(ctx, `SELECT status FROM team_join_requests WHERE id=$1 AND club_user_id=$2 FOR UPDATE`, requestID, clubID).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.JoinRequest{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.JoinRequest{}, err
	}
	if status != "pending" {
		return domain.JoinRequest{}, domain.ErrRequestClosed
	}
	var item domain.JoinRequest
	item.Status = decision
	if err = tx.QueryRowContext(ctx, `UPDATE team_join_requests SET status=$3,updated_at=now() WHERE id=$1 AND club_user_id=$2 RETURNING id,player_id,club_user_id,created_at,updated_at`, requestID, clubID, decision).Scan(&item.ID, &item.PlayerID, &item.ClubID, &item.CreatedAt, &item.UpdatedAt); err != nil {
		return domain.JoinRequest{}, err
	}
	if err = tx.QueryRowContext(ctx, `SELECT full_name FROM users WHERE id=$1`, item.PlayerID).Scan(&item.PlayerName); err != nil {
		return domain.JoinRequest{}, err
	}
	if decision == "accepted" {
		// Acceptance is what makes a player part of the club's squad.
		if _, err = tx.ExecContext(ctx, `INSERT INTO club_squad_members(club_user_id,player_id,request_id) VALUES($1,$2,$3) ON CONFLICT(club_user_id,player_id) DO UPDATE SET left_at=NULL,joined_at=clock_timestamp(),request_id=EXCLUDED.request_id`, clubID, item.PlayerID, item.ID); err != nil {
			return domain.JoinRequest{}, err
		}
	}
	if err = notificationsdata.CreateInTx(ctx, tx, notificationsdomain.NewTeamApplicationDecision(item.PlayerID, item.ID, item.ClubID, decision)); err != nil {
		return domain.JoinRequest{}, err
	}
	item.CreatedAt, item.UpdatedAt = item.CreatedAt.UTC(), item.UpdatedAt.UTC()
	if err = tx.Commit(); err != nil {
		return domain.JoinRequest{}, err
	}
	return item, nil
}
