import { copy } from '../../../shared/lib/copy';
import type {
  AuditEntry,
  AuditFilter,
  AuditRepository,
} from '../domain/models';

export function createAuditService(repository: AuditRepository) {
  return {
    list: (page: number, action: AuditFilter) =>
      repository.list(Math.max(1, page), action),
  };
}
export type AuditService = ReturnType<typeof createAuditService>;

const text = copy.audit;

// A readable name for an action: known events by name, admin writes by
// their route ("PUT /v1/admin/users/{id}/password").
export function describeAction(entry: AuditEntry): string {
  const known = text.actions[entry.action as keyof typeof text.actions];
  if (known) return known;
  if (entry.action.startsWith('admin.')) {
    return text.adminWrite(entry.action.slice('admin.'.length));
  }
  if (entry.action.startsWith('club.')) {
    return text.clubWrite(entry.action.slice('club.'.length));
  }
  return entry.action;
}
