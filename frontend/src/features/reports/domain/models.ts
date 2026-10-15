// Content reports from the mobile app: posts, replies and profiles waiting for
// an administrator decision. Resolving one closes every open report about the
// same target.
export type ReportTargetKind = 'post' | 'reply' | 'user';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate'
  | 'impersonation'
  | 'other';
export type ReportStatus = 'open' | 'dismissed' | 'removed' | 'suspended';
export type ReportTab = 'open' | 'resolved';
export type ReportAction = 'dismiss' | 'remove' | 'suspend';

export type ContentReport = {
  id: string;
  targetKind: ReportTargetKind;
  targetId: string;
  targetUserId?: string;
  targetName: string;
  targetRole: string;
  excerpt: string;
  reason: ReportReason;
  note: string;
  reporterName: string;
  status: ReportStatus;
  createdAt: string;
  resolvedAt?: string;
  targetReports: number;
};
export type ReportPage = {
  items: ContentReport[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export interface ReportsRepository {
  list(tab: ReportTab, page: number): Promise<ReportPage>;
  resolve(id: string, action: ReportAction): Promise<ContentReport>;
}

// Which actions a report offers: removal only for posts and replies,
// suspension only while the reported account still exists.
export function reportActions(report: ContentReport): ReportAction[] {
  if (report.status !== 'open') return [];
  const actions: ReportAction[] = ['dismiss'];
  if (report.targetKind !== 'user') actions.push('remove');
  if (report.targetUserId) actions.push('suspend');
  return actions;
}
