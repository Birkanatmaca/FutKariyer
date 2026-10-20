package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"regexp"
	"strconv"
	"strings"
	"time"

	"futcareer/backend/internal/systemlogs/domain"
)

type Postgres struct{ db *sql.DB }

var _ domain.Repository = (*Postgres)(nil)

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

const columns = `id,at,level,event,request_id,method,route,status,duration_ms,user_id,account_type,ip,client,app_version,version,security,message,attrs`

func (r *Postgres) Insert(ctx context.Context, entries []domain.Entry) error {
	if len(entries) == 0 {
		return nil
	}
	var b strings.Builder
	b.WriteString(`INSERT INTO system_logs(at,level,event,request_id,method,route,status,duration_ms,user_id,account_type,ip,client,app_version,version,security,message,attrs) VALUES `)
	args := make([]any, 0, len(entries)*17)
	for i, e := range entries {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteByte('(')
		for j := 0; j < 17; j++ {
			if j > 0 {
				b.WriteByte(',')
			}
			b.WriteString("$" + strconv.Itoa(i*17+j+1))
		}
		b.WriteByte(')')
		attrs, err := json.Marshal(e.Attrs)
		if err != nil {
			attrs = []byte("{}")
		}
		args = append(args, e.At, e.Level, e.Event, e.RequestID, e.Method, e.Route, e.Status, e.DurationMS, e.UserID, e.AccountType, e.IP, e.Client, e.AppVersion, e.Version, e.Security, e.Message, attrs)
	}
	_, err := r.db.ExecContext(ctx, b.String(), args...)
	return err
}

func scan(row interface{ Scan(...any) error }) (domain.Entry, error) {
	var e domain.Entry
	var attrs []byte
	err := row.Scan(&e.ID, &e.At, &e.Level, &e.Event, &e.RequestID, &e.Method, &e.Route, &e.Status, &e.DurationMS, &e.UserID, &e.AccountType, &e.IP, &e.Client, &e.AppVersion, &e.Version, &e.Security, &e.Message, &attrs)
	if err != nil {
		return e, err
	}
	e.At = e.At.UTC()
	if json.Unmarshal(attrs, &e.Attrs) != nil || e.Attrs == nil {
		e.Attrs = map[string]any{}
	}
	return e, nil
}

var hexID = regexp.MustCompile(`^[0-9a-f]{8,64}$`)

// where builds the filter; every value is a parameter.
func where(q domain.Query) (string, []any) {
	parts := []string{"at >= $1"}
	args := []any{q.Since}
	add := func(cond string, values ...any) {
		for _, v := range values {
			args = append(args, v)
			cond = strings.Replace(cond, "?", "$"+strconv.Itoa(len(args)), 1)
		}
		parts = append(parts, cond)
	}
	switch q.Kind {
	case domain.KindErrors:
		add("level='ERROR'")
	case domain.KindWarnings:
		add("level IN ('WARN','ERROR')")
	case domain.KindSecurity:
		add("security")
	case domain.KindClient:
		add("event='client.error'")
	case domain.KindSlow:
		add("event IN ('http.slow','db.slow_query')")
	case domain.KindRequests:
		add("event='http.request'")
	}
	if q.UserID != "" {
		add("user_id=?", q.UserID)
	}
	if search := strings.ToLower(strings.TrimSpace(q.Search)); search != "" {
		if hexID.MatchString(search) {
			// A request id, or the 8-character support code at its end.
			add("(request_id=? OR right(request_id,8)=? OR attrs->>'failed_request_id'=? OR right(attrs->>'failed_request_id',8)=?)", search, search, search, search)
		} else {
			add("(starts_with(event,?) OR strpos(lower(message),?)>0 OR strpos(route,?)>0)", search, search, search)
		}
	}
	return " WHERE " + strings.Join(parts, " AND "), args
}

func (r *Postgres) List(ctx context.Context, q domain.Query) (domain.Page, error) {
	out := domain.Page{Items: []domain.Entry{}, Page: q.Page}
	cond, args := where(q)
	if err := r.db.QueryRowContext(ctx, `SELECT count(*) FROM (SELECT 1 FROM system_logs`+cond+` LIMIT 10000) c`, args...).Scan(&out.Total); err != nil {
		return out, err
	}
	n := len(args)
	rows, err := r.db.QueryContext(ctx, `SELECT `+columns+` FROM system_logs`+cond+` ORDER BY at DESC,id DESC LIMIT $`+strconv.Itoa(n+1)+` OFFSET $`+strconv.Itoa(n+2),
		append(args, domain.PageSize, (q.Page-1)*domain.PageSize)...)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		e, err := scan(rows)
		if err != nil {
			return out, err
		}
		out.Items = append(out.Items, e)
	}
	return out, rows.Err()
}

func (r *Postgres) Get(ctx context.Context, id int64) (domain.Entry, error) {
	e, err := scan(r.db.QueryRowContext(ctx, `SELECT `+columns+` FROM system_logs WHERE id=$1`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return e, domain.ErrNotFound
	}
	return e, err
}

func (r *Postgres) Summary(ctx context.Context, since time.Time) (domain.Summary, error) {
	out := domain.Summary{Since: since, TopEvents: []domain.EventCount{}, SlowRoutes: []domain.RouteCount{}, Timeline: []domain.Bucket{}}
	err := r.db.QueryRowContext(ctx, `SELECT
		count(*) FILTER (WHERE level='ERROR'),
		count(*) FILTER (WHERE level='WARN'),
		count(*) FILTER (WHERE security),
		count(*) FILTER (WHERE event='client.error'),
		count(*) FILTER (WHERE event IN ('http.slow','db.slow_query'))
		FROM system_logs WHERE at>=$1`, since).Scan(&out.Errors, &out.Warnings, &out.Security, &out.ClientErrors, &out.Slow)
	if err != nil {
		return out, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT event,count(*),max(at) FROM system_logs WHERE at>=$1 AND level IN ('WARN','ERROR') AND event<>'http.request'
		GROUP BY event ORDER BY count(*) DESC,event LIMIT 8`, since)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var e domain.EventCount
		if err := rows.Scan(&e.Event, &e.Count, &e.Last); err != nil {
			rows.Close()
			return out, err
		}
		e.Last = e.Last.UTC()
		out.TopEvents = append(out.TopEvents, e)
	}
	rows.Close()
	rows, err = r.db.QueryContext(ctx, `SELECT route,count(*),COALESCE(max(duration_ms),0),count(*) FILTER (WHERE status>=500)
		FROM system_logs WHERE at>=$1 AND route<>'' AND (event='http.slow' OR (event='http.request' AND (status>=500 OR duration_ms>=1000)))
		GROUP BY route ORDER BY count(*) DESC,route LIMIT 8`, since)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var c domain.RouteCount
		if err := rows.Scan(&c.Route, &c.Count, &c.MaxMS, &c.Errors); err != nil {
			rows.Close()
			return out, err
		}
		out.SlowRoutes = append(out.SlowRoutes, c)
	}
	rows.Close()
	bucket := "hour"
	if time.Since(since) > 72*time.Hour {
		bucket = "day"
	}
	rows, err = r.db.QueryContext(ctx, `SELECT date_trunc('`+bucket+`',at) b,count(*) FILTER (WHERE level='ERROR'),count(*) FILTER (WHERE level='WARN')
		FROM system_logs WHERE at>=$1 AND level IN ('WARN','ERROR') GROUP BY b ORDER BY b`, since)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var b domain.Bucket
		if err := rows.Scan(&b.At, &b.Errors, &b.Warnings); err != nil {
			return out, err
		}
		b.At = b.At.UTC()
		out.Timeline = append(out.Timeline, b)
	}
	return out, rows.Err()
}

func (r *Postgres) Settings(ctx context.Context) (domain.Settings, error) {
	var s domain.Settings
	var by sql.NullString
	err := r.db.QueryRowContext(ctx, `SELECT level,store_requests,request_days,problem_days,security_days,updated_at,updated_by FROM log_settings`).
		Scan(&s.Level, &s.StoreRequests, &s.RequestDays, &s.ProblemDays, &s.SecurityDays, &s.UpdatedAt, &by)
	s.UpdatedAt = s.UpdatedAt.UTC()
	s.UpdatedBy = by.String
	return s, err
}

func (r *Postgres) SaveSettings(ctx context.Context, s domain.Settings, adminID string) (domain.Settings, error) {
	if _, err := r.db.ExecContext(ctx, `UPDATE log_settings SET level=$1,store_requests=$2,request_days=$3,problem_days=$4,security_days=$5,updated_at=now(),updated_by=$6`,
		s.Level, s.StoreRequests, s.RequestDays, s.ProblemDays, s.SecurityDays, adminID); err != nil {
		return s, err
	}
	return r.Settings(ctx)
}

func (r *Postgres) Cleanup(ctx context.Context, s domain.Settings, now time.Time) (int64, error) {
	var total int64
	for _, rule := range []struct {
		cond string
		days int
	}{
		{"NOT security AND level IN ('DEBUG','INFO')", s.RequestDays},
		{"NOT security AND level IN ('WARN','ERROR')", s.ProblemDays},
		{"security", s.SecurityDays},
	} {
		cutoff := now.AddDate(0, 0, -rule.days)
		for {
			result, err := r.db.ExecContext(ctx, `DELETE FROM system_logs WHERE id IN (SELECT id FROM system_logs WHERE at<$1 AND `+rule.cond+` LIMIT 5000)`, cutoff)
			if err != nil {
				return total, err
			}
			n, _ := result.RowsAffected()
			total += n
			if n < 5000 {
				break
			}
		}
	}
	return total, nil
}
