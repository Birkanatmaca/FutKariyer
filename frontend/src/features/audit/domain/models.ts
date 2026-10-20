// İşlem geçmişi (20 Oct 2026): the append-only audit log of admin writes,
// admin sign-ins and account security events.
export type AuditEntry = {
  id: number;
  at: string;
  actorType: 'user' | 'admin' | 'system';
  actorId: string;
  actorName: string;
  delegatedBy: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  ip: string;
};
export type AuditPage = { items: AuditEntry[]; total: number };
// Filters are action prefixes.
export const auditFilters = [
  '',
  'admin.',
  'admin.login',
  'admin.2fa',
  'auth.',
  'club.',
] as const;
export type AuditFilter = (typeof auditFilters)[number];
export const auditPageSize = 50;
export interface AuditRepository {
  list(page: number, action: AuditFilter): Promise<AuditPage>;
}
