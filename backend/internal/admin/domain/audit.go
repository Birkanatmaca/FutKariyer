package domain

import (
	"context"
	"time"
)

// AuditEntry is one row of the audit log as the İşlem geçmişi page shows it.
// ActorName is read now; a deleted account shows no name.
type AuditEntry struct {
	ID          int64          `json:"id"`
	At          time.Time      `json:"at"`
	ActorType   string         `json:"actorType"`
	ActorID     string         `json:"actorId"`
	ActorName   string         `json:"actorName"`
	DelegatedBy string         `json:"delegatedBy"`
	Action      string         `json:"action"`
	TargetType  string         `json:"targetType"`
	TargetID    string         `json:"targetId"`
	Details     map[string]any `json:"details"`
	IP          string         `json:"ip"`
}

type AuditQuery struct {
	Page     int
	PageSize int
	// Action filters by prefix, e.g. "admin." or "auth.password".
	Action  string
	ActorID string
}

type AuditPage struct {
	Items []AuditEntry `json:"items"`
	Total int          `json:"total"`
}

type AuditRepository interface {
	AuditLog(context.Context, AuditQuery) (AuditPage, error)
}
