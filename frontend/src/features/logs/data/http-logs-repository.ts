import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  LogEntry,
  LogPage,
  LogSettings,
  LogSummary,
  LogsRepository,
} from '../domain/models';

function check<T>(value: T, ok: boolean): T {
  if (!ok) throw new ApiError(copy.form.unexpected);
  return value;
}

export const logsRepository: LogsRepository = {
  async list(query) {
    const params = new URLSearchParams({
      hours: String(query.hours),
      page: String(query.page),
    });
    if (query.kind) params.set('kind', query.kind);
    if (query.search.trim()) params.set('q', query.search.trim());
    if (query.userId.trim()) params.set('user', query.userId.trim());
    const data = await request<LogPage>('/v1/admin/logs?' + params);
    return check(data, !!data && Array.isArray(data.items));
  },
  async get(id) {
    const data = await request<LogEntry>('/v1/admin/logs/' + id);
    return check(data, !!data && data.id === id);
  },
  async summary(hours) {
    const data = await request<LogSummary>(
      '/v1/admin/logs/summary?hours=' + hours,
    );
    return check(data, !!data && Array.isArray(data.topEvents));
  },
  async settings() {
    const data = await request<LogSettings>('/v1/admin/logs/settings');
    return check(data, !!data && typeof data.level === 'string');
  },
  async saveSettings(settings) {
    const data = await request<LogSettings>('/v1/admin/logs/settings', {
      method: 'PUT',
      body: {
        level: settings.level,
        storeRequests: settings.storeRequests,
        requestDays: settings.requestDays,
        problemDays: settings.problemDays,
        securityDays: settings.securityDays,
      },
    });
    return check(data, !!data && typeof data.level === 'string');
  },
};
