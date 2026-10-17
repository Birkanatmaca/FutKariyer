import React, { useCallback, useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import { Gift as GiftIcon } from 'lucide-react-native';
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
  parseWhole,
  validateGiftDraft,
  type FieldErrors,
} from '../../application/validation';
import type { GiftAudience, GiftDraft, GiftKind } from '../../domain/models';
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

const text = copy.admin.gifts;
const initial = {
  kind: 'application_right' as GiftKind,
  title: '',
  message: '',
  audience: 'all' as GiftAudience,
  email: '',
  validityDays: '7',
};

export function GiftsScreen({
  services,
  onBack,
}: {
  services: AdminServices;
  onBack(): void;
}) {
  const load = useCallback(() => services.gifts.list(), [services]);
  const history = useResource(load);
  const [form, setForm] = useState(initial);
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  function change<K extends keyof typeof initial>(
    key: K,
    value: (typeof initial)[K],
  ) {
    setForm(current => ({ ...current, [key]: value }));
  }
  async function send() {
    if (busy) return;
    const draft: GiftDraft = {
      ...form,
      validityDays: parseWhole(form.validityDays) ?? 0,
    };
    const local = validateGiftDraft(draft);
    setFields(local);
    setError(null);
    setNotice(null);
    if (Object.keys(local).length) return;
    const ok = await confirm(
      text.confirmTitle,
      draft.audience === 'all'
        ? text.confirmAll
        : text.confirmAccount(draft.email.trim()),
      text.submit,
      false,
    );
    if (!ok) return;
    Keyboard.dismiss();
    setBusy(true);
    try {
      const created = await services.gifts.create(draft);
      setForm(initial);
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
      keyOf={gift => gift.id}
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
              <Choices<GiftKind>
                label={text.kind}
                value={form.kind}
                onChange={value => change('kind', value)}
                error={fields.kind}
                hint={
                  form.kind === 'application_right'
                    ? text.applicationRightNote
                    : undefined
                }
                disabled={busy}
                // Heart gifts were retired with hearts (17 Oct 2026).
                options={(['application_right'] as const).map(value => ({
                  value,
                  label: text.kinds[value],
                }))}
              />
              <Field
                label={text.giftTitle}
                value={form.title}
                onChangeText={value => change('title', value)}
                error={fields.title}
                maxLength={limits.giftTitle[1]}
                editable={!busy}
              />
              <Field
                label={text.message}
                value={form.message}
                onChangeText={value => change('message', value)}
                error={fields.message}
                hint={
                  text.messageHint +
                  ' ' +
                  form.message.length +
                  '/' +
                  limits.giftMessage
                }
                maxLength={limits.giftMessage}
                multiline
                editable={!busy}
              />
              <Choices<GiftAudience>
                label={text.audience}
                value={form.audience}
                onChange={value => change('audience', value)}
                error={fields.audience}
                disabled={busy}
                options={(['all', 'account'] as const).map(value => ({
                  value,
                  label: text.audiences[value],
                }))}
              />
              {form.audience === 'account' ? (
                <Field
                  label={text.email}
                  value={form.email}
                  onChangeText={value => change('email', value)}
                  error={fields.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={limits.email}
                  editable={!busy}
                />
              ) : null}
              <Field
                label={text.validityDays}
                value={form.validityDays}
                onChangeText={value => change('validityDays', value)}
                error={fields.validityDays}
                hint={text.validityHint}
                keyboardType="number-pad"
                maxLength={3}
                editable={!busy}
              />
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
                    icon: GiftIcon,
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
          <View style={adminStyles.row}>
            <Text style={[adminStyles.rowTitle, adminStyles.flex]}>
              {item.title}
            </Text>
            <Tag label={text.kinds[item.kind]} tone="brand" />
          </View>
          {item.message ? (
            <Text style={adminStyles.rowBody}>{item.message}</Text>
          ) : null}
          <Text style={adminStyles.rowMeta}>
            {text.target(item.audience === 'all', item.targetEmail)} ·{' '}
            {formatDate(item.createdAt, true)}
          </Text>
          <Text style={adminStyles.rowMeta}>
            {text.stats(item.recipients, item.claimed, item.validityDays)}
          </Text>
        </Card>
      )}
    />
  );
}
