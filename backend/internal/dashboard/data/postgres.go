package data

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"futcareer/backend/internal/dashboard/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

// Days are Istanbul calendar days.
const tz = `'Europe/Istanbul'`

func day(column string) string {
	return `to_char(` + column + ` AT TIME ZONE ` + tz + `,'YYYY-MM-DD')`
}

const member = `role IN ('player','coach','club','organizer')`

type scanner struct {
	ctx context.Context
	tx  *sql.Tx
	err error
}

// one scans a single row into dest; the first error sticks.
func (s *scanner) one(query string, args []any, dest ...any) {
	if s.err != nil {
		return
	}
	if err := s.tx.QueryRowContext(s.ctx, query, args...).Scan(dest...); err != nil {
		s.err = fmt.Errorf("dashboard: %w", err)
	}
}

// each runs a query and calls fn per row.
func (s *scanner) each(query string, args []any, fn func(*sql.Rows) error) {
	if s.err != nil {
		return
	}
	rows, err := s.tx.QueryContext(s.ctx, query, args...)
	if err != nil {
		s.err = fmt.Errorf("dashboard: %w", err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		if err := fn(rows); err != nil {
			s.err = err
			return
		}
	}
	if err := rows.Err(); err != nil {
		s.err = err
	}
}

func (r *Postgres) Dashboard(ctx context.Context, q domain.Query) (domain.Dashboard, error) {
	out := domain.Dashboard{Days: q.Days, GeneratedAt: q.Now.UTC(), Roles: []domain.Slice{}, FootballTypes: []domain.Slice{}, Positions: []domain.Slice{}, Games: []domain.Slice{}, RecentUsers: []domain.RecentUser{}, RecentActions: []domain.RecentAction{}}
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return out, err
	}
	defer tx.Rollback()
	s := &scanner{ctx: ctx, tx: tx}
	since, prev, now := q.Since, q.Prev, q.Now
	w := []any{since}
	k := &out.KPIs
	m := &out.Modules

	// Headline numbers and their previous window.
	s.one(`SELECT count(*) FILTER (WHERE active),
		count(*) FILTER (WHERE created_at>=$1),
		count(*) FILTER (WHERE created_at>=$2 AND created_at<$1)
		FROM users WHERE `+member, []any{since, prev}, &k.Users, &k.NewUsers, &k.NewUsersPrev)
	s.one(`SELECT count(DISTINCT user_id) FILTER (WHERE last_seen_at>=$1::timestamptz-interval '1 day'),
		count(DISTINCT user_id) FILTER (WHERE last_seen_at>=$1::timestamptz-interval '7 days')
		FROM sessions WHERE audience='mobile'`, []any{now}, &k.Active24h, &k.Active7d)
	s.one(`SELECT count(*) FROM pro_memberships WHERE expires_at>$1`, []any{now}, &k.ProMembers)
	s.one(`SELECT COALESCE(sum(amount_minor) FILTER (WHERE confirmed_at>=$1),0),
		COALESCE(sum(amount_minor) FILTER (WHERE confirmed_at>=$2 AND confirmed_at<$1),0),
		count(*) FILTER (WHERE confirmed_at>=$1)
		FROM team_request_payments WHERE status='paid'`, []any{since, prev}, &k.Revenue, &k.RevenuePrev, &k.PaidOrders)
	s.one(`SELECT count(*) FILTER (WHERE created_at>=$1), count(*) FILTER (WHERE created_at>=$2 AND created_at<$1) FROM social_posts`, []any{since, prev}, &k.Posts, &k.PostsPrev)
	s.one(`SELECT COALESCE(sum(plays),0) FROM game_daily_plays WHERE day>=($1 AT TIME ZONE `+tz+`)::date`, w, &k.GamePlays)

	// Daily series, one grouped query per measure, merged by date.
	days := map[string]*domain.Day{}
	order := []string{}
	start := since.In(istanbul())
	for d := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, istanbul()); !d.After(now.In(istanbul())); d = d.AddDate(0, 0, 1) {
		key := d.Format("2006-01-02")
		days[key] = &domain.Day{Date: key}
		order = append(order, key)
	}
	count := func(query string, set func(*domain.Day, int64)) {
		s.each(query, w, func(rows *sql.Rows) error {
			var key string
			var n int64
			if err := rows.Scan(&key, &n); err != nil {
				return err
			}
			if d := days[key]; d != nil {
				set(d, n)
			}
			return nil
		})
	}
	s.each(`SELECT `+day("created_at")+`,role,count(*) FROM users WHERE created_at>=$1 AND `+member+` GROUP BY 1,2`, w, func(rows *sql.Rows) error {
		var key, role string
		var n int
		if err := rows.Scan(&key, &role, &n); err != nil {
			return err
		}
		if d := days[key]; d != nil {
			switch role {
			case "player":
				d.Players += n
			case "coach":
				d.Coaches += n
			default:
				d.Clubs += n
			}
		}
		return nil
	})
	count(`SELECT `+day("created_at")+`,count(*) FROM social_posts WHERE created_at>=$1 GROUP BY 1`, func(d *domain.Day, n int64) { d.Posts = int(n) })
	count(`SELECT `+day("created_at")+`,count(*) FROM social_replies WHERE created_at>=$1 GROUP BY 1`, func(d *domain.Day, n int64) { d.Replies = int(n) })
	count(`SELECT `+day("created_at")+`,count(*) FROM social_likes WHERE created_at>=$1 GROUP BY 1`, func(d *domain.Day, n int64) { d.Likes = int(n) })
	count(`SELECT to_char(day,'YYYY-MM-DD'),COALESCE(sum(plays),0) FROM game_daily_plays WHERE day>=($1 AT TIME ZONE `+tz+`)::date GROUP BY 1`, func(d *domain.Day, n int64) { d.GamePlays = int(n) })
	count(`SELECT `+day("confirmed_at")+`,COALESCE(sum(amount_minor),0) FROM team_request_payments WHERE status='paid' AND confirmed_at>=$1 GROUP BY 1`, func(d *domain.Day, n int64) { d.RevenueMinor = n })
	count(`SELECT `+day("confirmed_at")+`,count(*) FROM team_request_payments WHERE status='paid' AND confirmed_at>=$1 GROUP BY 1`, func(d *domain.Day, n int64) { d.Orders = int(n) })
	count(`SELECT `+day("at")+`,count(*) FROM system_logs WHERE level='ERROR' AND at>=$1 GROUP BY 1`, func(d *domain.Day, n int64) { d.Errors = int(n) })
	count(`SELECT `+day("at")+`,count(*) FROM system_logs WHERE level='WARN' AND at>=$1 GROUP BY 1`, func(d *domain.Day, n int64) { d.Warnings = int(n) })
	out.Daily = make([]domain.Day, 0, len(order))
	for _, key := range order {
		out.Daily = append(out.Daily, *days[key])
	}

	slices := func(query string, args []any, into *[]domain.Slice) {
		s.each(query, args, func(rows *sql.Rows) error {
			var item domain.Slice
			if err := rows.Scan(&item.Key, &item.Value); err != nil {
				return err
			}
			*into = append(*into, item)
			return nil
		})
	}
	slices(`SELECT role,count(*) FROM users WHERE active AND `+member+` GROUP BY role ORDER BY count(*) DESC`, nil, &out.Roles)
	slices(`SELECT football_type,count(*) FROM player_profiles p JOIN users u ON u.id=p.user_id WHERE u.active GROUP BY 1 ORDER BY 2 DESC`, nil, &out.FootballTypes)
	slices(`SELECT CASE WHEN position='' THEN 'unknown' ELSE position END,count(*) FROM player_profiles p JOIN users u ON u.id=p.user_id WHERE u.active GROUP BY 1 ORDER BY 2 DESC LIMIT 8`, nil, &out.Positions)
	slices(`SELECT game,COALESCE(sum(plays),0)::int FROM game_daily_plays WHERE day>=($1 AT TIME ZONE `+tz+`)::date GROUP BY 1 ORDER BY 2 DESC`, w, &out.Games)

	// One block per section.
	s.one(`SELECT count(*) FILTER (WHERE active),
		count(*) FILTER (WHERE active AND role='player'), count(*) FILTER (WHERE active AND role='coach'),
		count(*) FILTER (WHERE active AND role='club'), count(*) FILTER (WHERE active AND role='organizer'),
		count(*) FILTER (WHERE active AND verified), count(*) FILTER (WHERE NOT active AND approval_status='approved')
		FROM users WHERE `+member, nil, &m.Users.Total, &m.Users.Players, &m.Users.Coaches, &m.Users.Clubs, &m.Users.Organizers, &m.Users.Verified, &m.Users.Suspended)
	s.one(`SELECT count(*), count(*) FILTER (WHERE u.verified), count(*) FILTER (WHERE c.tff_team<>''),
		count(*) FILTER (WHERE EXISTS(SELECT 1 FROM club_staff s WHERE s.club_user_id=c.user_id AND s.status='active')),
		(SELECT count(*) FROM club_squad_members WHERE left_at IS NULL)
		FROM clubs c JOIN users u ON u.id=c.user_id WHERE u.active`, nil, &m.Clubs.Total, &m.Clubs.Verified, &m.Clubs.TFFLinked, &m.Clubs.WithStaff, &m.Clubs.Squad)
	s.one(`SELECT count(*) FILTER (WHERE u.approval_status='pending'),
		count(*) FILTER (WHERE u.approval_status='approved' AND a.decided_at>=$1),
		count(*) FILTER (WHERE u.approval_status='rejected' AND a.decided_at>=$1)
		FROM account_applications a JOIN users u ON u.id=a.user_id`, w, &m.Applications.Pending, &m.Applications.Approved, &m.Applications.Rejected)
	s.one(`SELECT count(*) FILTER (WHERE status='pending'), count(*) FILTER (WHERE status='accepted' AND updated_at>=$1) FROM team_join_requests`, w, &m.TeamRequests.Pending, &m.TeamRequests.Accepted)
	s.one(`SELECT count(*) FILTER (WHERE status='open'), count(*) FILTER (WHERE status<>'open' AND resolved_at>=$1) FROM content_reports`, w, &m.Reports.Open, &m.Reports.Resolved)
	s.one(`SELECT count(*) FILTER (WHERE published), count(*) FILTER (WHERE review_status='pending'), count(*) FILTER (WHERE created_at>=$1) FROM news_articles`, w, &m.News.Published, &m.News.PendingReview, &m.News.New)
	s.one(`SELECT count(*) FILTER (WHERE active), count(*) FROM advertisements`, nil, &m.Ads.Active, &m.Ads.Total)
	s.one(`SELECT count(*) FILTER (WHERE active), COALESCE((SELECT sum(views) FROM popup_ad_views),0) FROM popup_ads`, nil, &m.Popups.Active, &m.Popups.Views)
	s.one(`SELECT count(*) FILTER (WHERE created_at>=$1), count(*) FROM announcements`, w, &m.Announcements.Sent, &m.Announcements.Total)
	s.one(`SELECT count(*) FILTER (WHERE status='active'),
		(SELECT count(*) FROM league_teams t JOIN leagues l ON l.id=t.league_id WHERE l.status='active'),
		(SELECT count(*) FROM league_matches WHERE home_goals IS NULL AND kickoff_at BETWEEN $1::timestamptz AND $1::timestamptz+interval '7 days'),
		(SELECT count(*) FROM league_matches WHERE home_goals IS NOT NULL AND updated_at>=$2)
		FROM leagues`, []any{now, since}, &m.Leagues.Active, &m.Leagues.Teams, &m.Leagues.Upcoming, &m.Leagues.Played)
	var seasonID sql.NullString
	var endsAt sql.NullTime
	s.one(`SELECT COALESCE((SELECT id FROM rating_seasons WHERE published AND starts_at<=$1 AND ends_at>$1 ORDER BY starts_at DESC LIMIT 1),''),
		COALESCE((SELECT title FROM rating_seasons WHERE published AND starts_at<=$1 AND ends_at>$1 ORDER BY starts_at DESC LIMIT 1),''),
		(SELECT ends_at FROM rating_seasons WHERE published AND starts_at<=$1 AND ends_at>$1 ORDER BY starts_at DESC LIMIT 1)`, []any{now}, &seasonID, &m.Rating.Season, &endsAt)
	if endsAt.Valid {
		t := endsAt.Time.UTC()
		m.Rating.EndsAt = &t
	}
	if seasonID.String != "" {
		s.one(`SELECT count(DISTINCT user_id), COALESCE(sum(points),0) FROM rating_points WHERE season_id=$1`, []any{seasonID.String}, &m.Rating.Participants, &m.Rating.Points)
	}
	s.one(`SELECT COALESCE(sum(amount_minor) FILTER (WHERE status='paid' AND confirmed_at>=$1),0),
		count(*) FILTER (WHERE status='paid' AND confirmed_at>=$1),
		count(*) FILTER (WHERE status='refunded' AND updated_at>=$1),
		count(*) FILTER (WHERE status='pending' AND created_at>=$1),
		count(*) FILTER (WHERE status='paid' AND confirmed_at>=$1 AND product='pro')
		FROM team_request_payments`, w, &m.Payments.Revenue, &m.Payments.Paid, &m.Payments.Refunded, &m.Payments.Pending, &m.Payments.Pro)
	s.one(`SELECT count(*) FILTER (WHERE created_at>=$1), count(*) FILTER (WHERE claimed_at>=$1) FROM user_gifts`, w, &m.Gifts.Sent, &m.Gifts.Claimed)
	s.one(`SELECT count(*) FILTER (WHERE actor_type='admin' AND at>=$1), count(*) FILTER (WHERE action='admin.login' AND at>=$1) FROM audit_log WHERE at>=$1`, w, &m.Audit.Actions, &m.Audit.AdminLogins)
	s.one(`SELECT count(*) FILTER (WHERE level='ERROR'), count(*) FILTER (WHERE level='WARN'), count(*) FILTER (WHERE security) FROM system_logs WHERE at>=$1`, w, &m.Logs.Errors, &m.Logs.Warnings, &m.Logs.Security)
	s.one(`SELECT (SELECT count(*) FROM social_posts WHERE created_at>=$1),(SELECT count(*) FROM social_replies WHERE created_at>=$1),
		(SELECT count(*) FROM social_likes WHERE created_at>=$1),(SELECT count(*) FROM profile_follows WHERE created_at>=$1)`, w, &m.Social.Posts, &m.Social.Replies, &m.Social.Likes, &m.Social.Follows)
	s.one(`SELECT count(*) FILTER (WHERE status='pending'), count(*) FILTER (WHERE status='accepted' AND responded_at>=$1) FROM connection_requests`, w, &m.Connections.Pending, &m.Connections.Accepted)
	s.one(`SELECT count(*) FILTER (WHERE status='open'), (SELECT count(*) FROM tournament_entries WHERE created_at>=$1) FROM tournaments`, w, &m.Tournaments.Open, &m.Tournaments.Entries)

	s.each(`SELECT id,full_name,role,created_at FROM users WHERE `+member+` ORDER BY created_at DESC LIMIT 6`, nil, func(rows *sql.Rows) error {
		var u domain.RecentUser
		if err := rows.Scan(&u.ID, &u.FullName, &u.Role, &u.CreatedAt); err != nil {
			return err
		}
		u.CreatedAt = u.CreatedAt.UTC()
		out.RecentUsers = append(out.RecentUsers, u)
		return nil
	})
	s.each(`SELECT a.at,a.action,COALESCE(u.full_name,''),a.actor_type FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.at DESC,a.id DESC LIMIT 6`, nil, func(rows *sql.Rows) error {
		var a domain.RecentAction
		if err := rows.Scan(&a.At, &a.Action, &a.ActorName, &a.ActorType); err != nil {
			return err
		}
		a.At = a.At.UTC()
		out.RecentActions = append(out.RecentActions, a)
		return nil
	})
	if s.err != nil {
		return out, s.err
	}
	return out, tx.Commit()
}

func istanbul() *time.Location {
	loc, err := time.LoadLocation("Europe/Istanbul")
	if err != nil {
		return time.FixedZone("TRT", 3*60*60)
	}
	return loc
}
