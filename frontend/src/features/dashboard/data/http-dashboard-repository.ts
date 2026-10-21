import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type { Dashboard, DashboardRepository } from '../domain/models';

export const dashboardRepository: DashboardRepository = {
  async load(days) {
    const data = await request<Dashboard>('/v1/admin/dashboard?days=' + days);
    if (!data || !Array.isArray(data.daily) || !data.kpis || !data.modules) {
      throw new ApiError(copy.form.unexpected);
    }
    return data;
  },
};
