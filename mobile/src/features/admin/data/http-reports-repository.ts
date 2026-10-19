import type {
  AdminGateway,
  ContentReport,
  ReportAction,
  ReportStatus,
  ReportsRepository,
} from '../domain/models';
import {
  isCount,
  isId,
  isOneOf,
  isPage,
  isRecord,
  isText,
  isTimestamp,
  segment,
  unexpected,
} from './validators';

export const reportPageSize = 20;
const outcome: Record<ReportAction, ReportStatus> = {
  dismiss: 'dismissed',
  remove: 'removed',
  suspend: 'suspended',
};

export function isContentReport(value: unknown): value is ContentReport {
  return (
    isRecord(value) &&
    isId(value.id) &&
    isOneOf(value.targetKind, ['post', 'reply', 'user']) &&
    isId(value.targetId) &&
    (value.targetUserId === undefined || isId(value.targetUserId)) &&
    isText(value.targetName) &&
    isText(value.targetRole) &&
    isText(value.excerpt) &&
    isOneOf(value.reason, [
      'spam',
      'harassment',
      'inappropriate',
      'impersonation',
      'other',
    ]) &&
    isText(value.note) &&
    isText(value.reporterName) &&
    isOneOf(value.status, ['open', 'dismissed', 'removed', 'suspended']) &&
    isTimestamp(value.createdAt) &&
    (value.resolvedAt === undefined || isTimestamp(value.resolvedAt)) &&
    isCount(value.targetReports)
  );
}

export function createReportsRepository(
  gateway: AdminGateway,
): ReportsRepository {
  return {
    async list(queue, page) {
      const result = await gateway.request<unknown>(
        '/v1/admin/reports?status=' +
          queue +
          '&page=' +
          page +
          '&pageSize=' +
          reportPageSize,
      );
      // Each queue only carries reports in its own state.
      if (
        !isPage(result, isContentReport, page, reportPageSize) ||
        !result.items.every(
          item => (item.status === 'open') === (queue === 'open'),
        )
      )
        unexpected();
      return result;
    },
    async resolve(id, action) {
      const result = await gateway.request<unknown>(
        '/v1/admin/reports/' + segment(id) + '/resolve',
        { method: 'POST', body: { action } },
      );
      if (
        !isRecord(result) ||
        !isContentReport(result.report) ||
        result.report.id !== id ||
        result.report.status !== outcome[action]
      )
        unexpected();
      return result.report as ContentReport;
    },
  };
}
