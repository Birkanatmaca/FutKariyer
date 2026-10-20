package data

import (
	"context"
	"encoding/json"

	"futcareer/backend/internal/admin/domain"
)

var _ domain.AuditRepository = (*Postgres)(nil)

func (r *Postgres) AuditLog(ctx context.Context, q domain.AuditQuery) (domain.AuditPage, error) {
	out := domain.AuditPage{Items: []domain.AuditEntry{}}
	where := ` WHERE ($1='' OR starts_with(a.action,$1)) AND ($2='' OR a.actor_id=$2 OR a.delegated_by=$2 OR a.target_id=$2)`
	if err := r.db.QueryRowContext(ctx, `SELECT count(*) FROM audit_log a`+where, q.Action, q.ActorID).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT a.id,a.at,a.actor_type,COALESCE(a.actor_id,''),COALESCE(u.full_name,''),COALESCE(a.delegated_by,''),
		a.action,a.target_type,a.target_id,a.details,COALESCE(host(a.ip),'')
		FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id`+where+` ORDER BY a.at DESC,a.id DESC LIMIT $3 OFFSET $4`,
		q.Action, q.ActorID, q.PageSize, (q.Page-1)*q.PageSize)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var e domain.AuditEntry
		var details []byte
		if err := rows.Scan(&e.ID, &e.At, &e.ActorType, &e.ActorID, &e.ActorName, &e.DelegatedBy, &e.Action, &e.TargetType, &e.TargetID, &details, &e.IP); err != nil {
			return out, err
		}
		e.At = e.At.UTC()
		if err := json.Unmarshal(details, &e.Details); err != nil || e.Details == nil {
			e.Details = map[string]any{}
		}
		out.Items = append(out.Items, e)
	}
	return out, rows.Err()
}
