import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  ContentReport,
  ReportAction,
  ReportPage,
  ReportsRepository,
  ReportTab,
} from '../domain/models';

export const reportsPageSize = 20;
const idPattern = /^[0-9a-f]{32}$/;
const validDate = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const text = (value: unknown) => typeof value === 'string';
const count = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const resolvedStatus: Record<ReportAction, ContentReport['status']> = {
  dismiss: 'dismissed',
  remove: 'removed',
  suspend: 'suspended',
};

export function validReport(value: unknown): value is ContentReport {
  const item = value as ContentReport;
  return (
    !!item &&
    idPattern.test(String(item.id)) &&
    ['post', 'reply', 'user'].includes(item.targetKind) &&
    idPattern.test(String(item.targetId)) &&
    (item.targetUserId === undefined ||
      idPattern.test(String(item.targetUserId))) &&
    text(item.targetName) &&
    text(item.targetRole) &&
    text(item.excerpt) &&
    ['spam', 'harassment', 'inappropriate', 'impersonation', 'other'].includes(
      item.reason,
    ) &&
    text(item.note) &&
    text(item.reporterName) &&
    ['open', 'dismissed', 'removed', 'suspended'].includes(item.status) &&
    validDate(item.createdAt) &&
    (item.resolvedAt === undefined || validDate(item.resolvedAt)) &&
    count(item.targetReports)
  );
}

export const reportsRepository: ReportsRepository = {
  async list(tab: ReportTab, page: number) {
    const result = await request<ReportPage>(
      '/v1/admin/reports?status=' +
        tab +
        '&page=' +
        page +
        '&pageSize=' +
        reportsPageSize,
    );
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(validReport) ||
      !result.items.every(
        item => (item.status === 'open') === (tab === 'open'),
      ) ||
      result.page !== page ||
      !count(result.total) ||
      !count(result.totalPages)
    )
      throw new ApiError(copy.form.unexpected);
    return result;
  },
  async resolve(id: string, action: ReportAction) {
    if (!idPattern.test(id)) throw new ApiError(copy.form.unexpected);
    const result = await request<{ report: unknown }>(
      '/v1/admin/reports/' + id + '/resolve',
      { method: 'POST', body: { action } },
    );
    if (
      !result ||
      !validReport(result.report) ||
      result.report.id !== id ||
      result.report.status !== resolvedStatus[action]
    )
      throw new ApiError(copy.form.unexpected);
    return result.report;
  },
};
