import React, { useCallback, useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import { ClipboardCheck } from 'lucide-react-native';
import { ErrorBanner } from '../../../../shared/ui/ErrorBanner';
import { Field } from '../../../../shared/ui/Field';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { ApiError } from '../../../../shared/api/client';
import { copy } from '../../../../shared/lib/copy';
import type { AdminServices } from '../../application/admin-services';
import { errorMessage, useResource } from '../../application/hooks';
import { limits } from '../../application/validation';
import type {
  AccountApplication,
  ApplicationDecision,
  ApplicationStatus,
} from '../../domain/models';
import { AdminList } from '../parts/AdminList';
import {
  Card,
  InfoRow,
  LoadState,
  Segmented,
  SmallButton,
  SuccessNotice,
  Tag,
  adminStyles,
  formatDate,
} from '../parts/AdminParts';
import { confirm } from '../parts/confirm';

const text = copy.admin.applications;

export function ApplicationsScreen({
  services,
  onDecided,
}: {
  services: AdminServices;
  // Lets the shell refresh pending counters after a decision.
  onDecided?(): void;
}) {
  const [status, setStatus] = useState<ApplicationStatus>('pending');
  const load = useCallback(
    () => services.applications.list(status),
    [services, status],
  );
  const list = useResource(load);
  const [busy, setBusy] = useState<{
    id: string;
    decision: ApplicationDecision;
  } | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  async function decide(
    application: AccountApplication,
    decision: ApplicationDecision,
  ) {
    if (busy) return;
    const ok =
      decision === 'approve'
        ? await confirm(
            text.approveTitle,
            text.approveBody(application.fullName),
            text.approve,
            false,
          )
        : await confirm(
            text.rejectTitle,
            text.rejectBody(application.fullName),
            text.reject,
          );
    if (!ok) return;
    Keyboard.dismiss();
    setBusy({ id: application.userId, decision });
    setNotice(null);
    setActionError(null);
    setReasonError(undefined);
    try {
      await services.applications.decide(
        application.userId,
        decision,
        decision === 'reject' ? reason : '',
      );
      list.setData(current =>
        current
          ? current.filter(item => item.userId !== application.userId)
          : current,
      );
      setRejecting(null);
      setReason('');
      setNotice(
        decision === 'approve'
          ? text.approved(application.fullName)
          : text.rejected(application.fullName),
      );
      onDecided?.();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409) {
        setActionError(text.alreadyDecided);
        setRejecting(null);
        list.refresh();
      } else if (failure instanceof ApiError && failure.status === 404) {
        setActionError(text.notFound);
        setRejecting(null);
        list.refresh();
      } else if (failure instanceof ApiError && failure.status === 422) {
        setReasonError(failure.fields.reason || failure.message);
      } else {
        setActionError(errorMessage(failure));
      }
    } finally {
      setBusy(null);
    }
  }
  const items = list.data ?? [];
  return (
    <AdminList
      items={list.loading || list.error ? [] : items}
      keyOf={item => item.userId}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      header={
        <>
          <PageHeader
            eyebrow={text.eyebrow}
            title={text.title}
            description={text.description}
          />
          <Segmented
            value={status}
            disabled={!!busy}
            onChange={value => {
              setStatus(value);
              setRejecting(null);
              setNotice(null);
              setActionError(null);
            }}
            options={(['pending', 'approved', 'rejected'] as const).map(
              value => ({
                value,
                label: text.tabs[value],
                badge:
                  value === 'pending' && status === 'pending'
                    ? list.data?.length
                    : null,
              }),
            )}
          />
          <SuccessNotice message={notice} />
          <ErrorBanner message={actionError} />
          <LoadState
            loading={list.loading}
            error={list.error}
            onRetry={list.retry}
            empty={
              list.data && !list.data.length
                ? {
                    icon: ClipboardCheck,
                    title: text.empty[status],
                    body: text.emptyHint[status],
                  }
                : null
            }
          />
        </>
      }
      renderItem={({ item }) => (
        <ApplicationCard
          application={item}
          busy={busy}
          rejecting={rejecting === item.userId}
          reason={reason}
          reasonError={reasonError}
          onReason={setReason}
          onApprove={() => decide(item, 'approve')}
          onOpenReject={() => {
            setRejecting(item.userId);
            setReason('');
            setReasonError(undefined);
          }}
          onCancelReject={() => setRejecting(null)}
          onConfirmReject={() => decide(item, 'reject')}
        />
      )}
    />
  );
}

function ApplicationCard({
  application,
  busy,
  rejecting,
  reason,
  reasonError,
  onReason,
  onApprove,
  onOpenReject,
  onCancelReject,
  onConfirmReject,
}: {
  application: AccountApplication;
  busy: { id: string; decision: ApplicationDecision } | null;
  rejecting: boolean;
  reason: string;
  reasonError?: string;
  onReason(value: string): void;
  onApprove(): void;
  onOpenReject(): void;
  onCancelReject(): void;
  onConfirmReject(): void;
}) {
  const own = busy?.id === application.userId;
  return (
    <Card>
      <View style={adminStyles.wrap}>
        <Tag label={text.roles[application.role]} tone="info" />
        {application.status !== 'pending' ? (
          <Tag
            label={text.tabs[application.status]}
            tone={application.status === 'approved' ? 'success' : 'danger'}
          />
        ) : null}
      </View>
      <Text style={adminStyles.rowTitle}>{application.fullName}</Text>
      <InfoRow label={text.contactName} value={application.contactName} />
      <InfoRow label={text.username} value={application.username} />
      <InfoRow label={text.email} value={application.email} />
      <InfoRow label={text.phone} value={application.phone} />
      <InfoRow label={text.district} value={application.district} />
      {application.role === 'club' ? (
        <InfoRow
          label={text.footballType}
          value={
            application.footballType
              ? copy.admin.footballTypes[application.footballType]
              : ''
          }
        />
      ) : null}
      {application.note ? (
        <InfoRow label={text.note} value={application.note} />
      ) : null}
      <InfoRow
        label={text.submittedAt}
        value={formatDate(application.submittedAt, true)}
      />
      {application.decidedAt ? (
        <InfoRow
          label={text.decidedAt}
          value={formatDate(application.decidedAt, true)}
        />
      ) : null}
      {application.status === 'rejected' ? (
        <InfoRow
          label={text.reason}
          value={application.rejectionReason || text.noReason}
        />
      ) : null}
      {application.status === 'pending' ? (
        rejecting ? (
          <View style={adminStyles.form}>
            <Field
              label={text.reasonLabel}
              value={reason}
              onChangeText={onReason}
              error={reasonError}
              hint={
                text.reasonHint +
                ' ' +
                reason.length +
                ' / ' +
                limits.rejectionReason
              }
              maxLength={limits.rejectionReason}
              multiline
              editable={!busy}
            />
            <View style={adminStyles.actions}>
              <SmallButton
                label={copy.admin.common.cancel}
                onPress={onCancelReject}
                disabled={!!busy}
              />
              <SmallButton
                label={text.confirmReject}
                tone="danger"
                onPress={onConfirmReject}
                loading={own && busy?.decision === 'reject'}
                disabled={!!busy}
              />
            </View>
          </View>
        ) : (
          <View style={adminStyles.actions}>
            <SmallButton
              label={text.reject}
              accessibilityLabel={application.fullName + ', ' + text.reject}
              tone="danger"
              onPress={onOpenReject}
              disabled={!!busy}
            />
            <SmallButton
              label={text.approve}
              accessibilityLabel={application.fullName + ', ' + text.approve}
              tone="brand"
              onPress={onApprove}
              loading={own && busy?.decision === 'approve'}
              disabled={!!busy}
            />
          </View>
        )
      ) : null}
    </Card>
  );
}
