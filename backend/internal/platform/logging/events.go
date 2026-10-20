package logging

// Event names: "area.action[.result]". Search the code for these to find
// where an event is written; add new ones here.
const (
	EventRequest    = "http.request"
	EventSlow       = "http.slow"
	EventPanic      = "http.panic"
	EventError      = "http.error"
	EventStart      = "system.start"
	EventStop       = "system.stop"
	EventJobPanic   = "job.panic"
	EventJobFailed  = "job.failed"
	EventSlowQuery  = "db.slow_query"
	EventClientErr  = "client.error"
	EventUpstream   = "upstream.failed"
	EventRateLimit  = "abuse.rate_limited"
	EventAuditWrite = "audit.write_failed"
	// Security events carry "security": true and are kept for a year.
	EventLoginFailed = "auth.login.failed"
	EventLoginLocked = "auth.login.locked"
	EventForbidden   = "auth.forbidden"
)
