import React, { useCallback, useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import { Megaphone } from 'lucide-react-native';
import { BackLink } from '../../../../shared/ui/BackLink';
import { Button } from '../../../../shared/ui/Button';
import { ErrorBanner } from '../../../../shared/ui/ErrorBanner';
import { Field } from '../../../../shared/ui/Field';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { ApiError } from '../../../../shared/api/client';
import { copy } from '../../../../shared/lib/copy';
import type { AdminServices } from '../../application/admin-services';
import { errorMessage, useResource } from '../../application/hooks';
import {
  limits,
  validateAnnouncementDraft,
  type FieldErrors,
} from '../../application/validation';
import type {
  AnnouncementAudience,
  AnnouncementDraft,
} from '../../domain/models';
import { AdminList } from '../parts/AdminList';
import {
  Card,
  Choices,
  LoadState,
  SectionTitle,
  SuccessNotice,
  Tag,
  adminStyles,
  formatDate,
} from '../parts/AdminParts';
import { confirm } from '../parts/confirm';

const text = copy.admin.announcements;
const initial: AnnouncementDraft = {
  title: '',
  body: '',
  audience: 'all',
  email: '',
};

// Announcements are only created; sent ones cannot be edited or deleted.
export function AnnouncementsScreen({
  services,
  onBack,
}: {
  services: AdminServices;
  onBack(): void;
}) {
  const load = useCallback(() => services.announcements.list(), [services]);
  const history = useResource(load);
  const [draft, setDraft] = useState(initial);
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  function change<K extends keyof AnnouncementDraft>(
    key: K,
    value: AnnouncementDraft[K],
  ) {
    setDraft(current => ({ ...current, [key]: value }));
  }
  async function send() {
    if (busy) return;
    const local = validateAnnouncementDraft(draft);
    setFields(local);
    setError(null);
    setNotice(null);
    if (Object.keys(local).length) return;
    const target =
      draft.audience === 'account'
        ? draft.email.trim()
        : text.audiences[draft.audience];
    if (
      !(await confirm(
        text.confirmTitle,
        text.confirmBody(target),
        text.submit,
        false,
      ))
    )
      return;
    Keyboard.dismiss();
    setBusy(true);
    try {
      const created = await services.announcements.create(draft);
      setDraft(initial);
      setNotice(text.sent(created.recipients));
      history.refresh();
    } catch (failure) {
      if (failure instanceof ApiError) setFields(failure.fields);
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminList
      items={history.data ?? []}
      keyOf={item => item.id}
      refreshing={history.refreshing}
      onRefresh={history.refresh}
      header={
        <>
          <BackLink label={copy.admin.common.back} onPress={onBack} />
          <PageHeader
            eyebrow={text.eyebrow}
            title={text.title}
            description={text.description}
          />
          <Card>
            <SectionTitle title={text.formTitle} />
            <View style={adminStyles.form}>
              <Field
                label={text.announcementTitle}
                value={draft.title}
                onChangeText={value => change('title', value)}
                error={fields.title}
                maxLength={limits.announcementTitle[1]}
                editable={!busy}
              />
              <Field
                label={text.body}
                value={draft.body}
                onChangeText={value => change('body', value)}
                error={fields.body}
                hint={
                  text.bodyHint +
                  ' ' +
                  draft.body.length +
                  '/' +
                  limits.announcementBody
                }
                maxLength={limits.announcementBody}
                multiline
                editable={!busy}
              />
              <Choices<AnnouncementAudience>
                label={text.audience}
                value={draft.audience}
                onChange={value => change('audience', value)}
                error={fields.audience}
                disabled={busy}
                options={(
                  ['all', 'player', 'club', 'coach', 'account'] as const
                ).map(value => ({ value, label: text.audiences[value] }))}
              />
              {draft.audience === 'account' ? (
                <Field
                  label={text.email}
                  value={draft.email}
                  onChangeText={value => change('email', value)}
                  error={fields.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={limits.email}
                  editable={!busy}
                />
              ) : null}
              <SuccessNotice message={notice} />
              <ErrorBanner message={error} />
              <Button label={text.submit} onPress={send} loading={busy} />
            </View>
          </Card>
          <SectionTitle title={text.history} />
          <LoadState
            loading={history.loading}
            error={history.error}
            onRetry={history.retry}
            empty={
              history.data && !history.data.length
                ? {
                    icon: Megaphone,
                    title: text.emptyTitle,
                    body: text.emptyBody,
                  }
                : null
            }
          />
        </>
      }
      renderItem={({ item }) => (
        <Card>
          <Text style={adminStyles.rowTitle}>{item.title}</Text>
          <Text style={adminStyles.rowBody}>{item.body}</Text>
          <View style={adminStyles.wrap}>
            <Tag
              label={
                item.audience === 'account'
                  ? item.targetEmail || text.audiences.account
                  : text.audiences[item.audience]
              }
              tone="info"
            />
            <Tag label={text.recipients(item.recipients)} />
          </View>
          <Text style={adminStyles.rowMeta}>
            {formatDate(item.createdAt, true)}
          </Text>
        </Card>
      )}
    />
  );
}
