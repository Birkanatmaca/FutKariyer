import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type { AuditPage, AuditRepository } from '../domain/models';

export const auditRepository: AuditRepository = {
  async list(page, action) {
    const query = new URLSearchParams({ page: String(page) });
    if (action) query.set('action', action);
    const data = await request<AuditPage>('/v1/admin/audit?' + query);
    if (!data || !Array.isArray(data.items) || typeof data.total !== 'number') {
      throw new ApiError(copy.form.unexpected);
    }
    return data;
  },
};
