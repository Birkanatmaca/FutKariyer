import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Flag } from 'lucide-react-native';
import { BackLink } from '../../../../shared/ui/BackLink';
import { ErrorBanner } from '../../../../shared/ui/ErrorBanner';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { ApiError } from '../../../../shared/api/client';
import { copy } from '../../../../shared/lib/copy';
import type { AdminServices } from '../../application/admin-services';
import { errorMessage, usePagedList } from '../../application/hooks';
import { reportActions } from '../../application/validation';
import type {
  ContentReport,
  ManagedRole,
  ReportAction,
  ReportQueue,
  ReportStatus,
} from '../../domain/models';
import { AdminList } from '../parts/AdminList';
import {
  Card,
  InfoRow,
  LoadMore,
  LoadState,
  Segmented,
  SmallButton,
  SuccessNotice,
  Tag,
  adminStyles,
  formatDate,
  type Tone,
} from '../parts/AdminParts';
import { confirm } from '../parts/confirm';

const text = copy.admin.reports;
const statusTone: Record<ReportStatus, Tone> = {
  open: 'warning',
  dismissed: 'neutral',
  removed: 'danger',
  suspended: 'danger',
};
type Busy = { id: string; action: ReportAction } | null;

function roleLabel(role: string) {
  return role in copy.admin.roles
    ? copy.admin.roles[role as ManagedRole]
    : '';
}

export function ReportsScreen({
  services,
  onBack,
}: {
  services: AdminServices;
  onBack(): void;
}) {
  const [queue, setQueue] = useState<ReportQueue>('open');
  const load = useCallback(
    (page: number) => services.reports.list(queue, page),
    [services, queue],
  );
  const list = usePagedList(load);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function resolve(report: ContentReport, action: ReportAction) {
    if (busy) return;
    const name = report.targetName || text.unknownTarget;
    if (
      action === 'remove' &&
      !(await confirm(text.removeTitle, text.removeBody(name), text.remove))
    )
      return;
    if (
      action === 'suspend' &&
      !(await confirm(text.suspendTitle, text.suspendBody(name), text.suspend))
    )
      return;
    setBusy({ id: report.id, action });
    setNotice(null);
    setActionError(null);
    try {
      await services.reports.resolve(report.id, action);
      setNotice(
        action === 'dismiss'
          ? text.dismissed
          : action === 'remove'
          ? text.removed
          : text.suspended(name),
      );
      // Other open reports about the same target were closed too.
      list.refresh();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409) {
        setActionError(text.alreadyResolved);
        list.refresh();
      } else if (failure instanceof ApiError && failure.status === 404) {
        setActionError(text.notFound);
        list.refresh();
      } else {
        setActionError(errorMessage(failure));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminList
      items={list.loading || list.error ? [] : list.items}
      keyOf={report => report.id}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onEndReached={list.loadMore}
      header={
        <>
          <BackLink label={copy.admin.common.back} onPress={onBack} />
          <PageHeader
            eyebrow={text.eyebrow}
            title={text.title}
            description={text.description}
          />
          <Segmented
            value={queue}
            disabled={!!busy}
            onChange={value => {
              setQueue(value);
              setNotice(null);
              setActionError(null);
            }}
            options={(['open', 'resolved'] as const).map(value => ({
              value,
              label: text.tabs[value],
              badge: value === 'open' && queue === 'open' ? list.total : null,
            }))}
          />
          <SuccessNotice message={notice} />
          <ErrorBanner message={actionError} />
          <LoadState
            loading={list.loading}
            error={list.error}
            onRetry={list.retry}
            empty={
              list.last && !list.items.length
                ? {
                    icon: Flag,
                    title: text.empty[queue],
                    body: text.emptyHint[queue],
                  }
                : null
            }
          />
        </>
      }
      footer={
        <LoadMore
          hasMore={list.hasMore}
          loadingMore={list.loadingMore}
          error={list.moreError}
          onMore={list.loadMore}
        />
      }
      renderItem={({ item }) => (
        <ReportCard
          report={item}
          busy={busy}
          onResolve={action => resolve(item, action)}
        />
      )}
    />
  );
}

function ReportCard({
  report,
  busy,
  onResolve,
}: {
  report: ContentReport;
  busy: Busy;
  onResolve(action: ReportAction): void;
}) {
  const own = busy?.id === report.id;
  const name = report.targetName || text.unknownTarget;
  const role = roleLabel(report.targetRole);
  const actions = reportActions(report);
  return (
    <Card>
      <View style={adminStyles.wrap}>
        <Tag label={text.kinds[report.targetKind]} tone="info" />
        <Tag
          label={text.statuses[report.status]}
          tone={statusTone[report.status]}
        />
        {report.targetReports > 1 ? (
          <Tag label={text.openCount(report.targetReports)} tone="warning" />
        ) : null}
      </View>
      <View>
        <Text style={adminStyles.rowTitle}>{name}</Text>
        {role ? <Text style={adminStyles.rowMeta}>{role}</Text> : null}
      </View>
      <InfoRow label={text.excerpt} value={report.excerpt || text.noExcerpt} />
      <InfoRow label={text.reason} value={text.reasons[report.reason]} />
      {report.note ? <InfoRow label={text.note} value={report.note} /> : null}
      <InfoRow
        label={text.reporter}
        value={report.reporterName || text.unknownReporter}
      />
      <InfoRow
        label={text.createdAt}
        value={formatDate(report.createdAt, true)}
      />
      {report.resolvedAt ? (
        <InfoRow
          label={text.resolvedAt}
          value={formatDate(report.resolvedAt, true)}
        />
      ) : null}
      {actions.length ? (
        <View style={adminStyles.actions}>
          {actions.map(action => (
            <SmallButton
              key={action}
              label={text[action]}
              accessibilityLabel={name + ', ' + text[action]}
              tone={action === 'dismiss' ? 'secondary' : 'danger'}
              onPress={() => onResolve(action)}
              loading={own && busy?.action === action}
              disabled={!!busy}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}
