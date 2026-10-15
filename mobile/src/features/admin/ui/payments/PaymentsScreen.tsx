import React, { useCallback, useEffect, useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import {
  Banknote,
  CreditCard,
  ReceiptText,
  Search,
  Undo2,
} from 'lucide-react-native';
import { BackLink } from '../../../../shared/ui/BackLink';
import { ErrorBanner } from '../../../../shared/ui/ErrorBanner';
import { Field } from '../../../../shared/ui/Field';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { ApiError } from '../../../../shared/api/client';
import { copy } from '../../../../shared/lib/copy';
import type { AdminServices } from '../../application/admin-services';
import {
  errorMessage,
  usePagedList,
  useResource,
} from '../../application/hooks';
import { parsePrice, priceText } from '../../application/validation';
import type {
  PaymentFilter,
  PaymentPackage,
  PaymentStatus,
} from '../../domain/models';
import { AdminList } from '../parts/AdminList';
import { ProPlanCard } from './ProPlanCard';
import {
  Card,
  Choices,
  LoadMore,
  LoadState,
  Metric,
  SectionTitle,
  SmallButton,
  SuccessNotice,
  Tag,
  ToggleRow,
  adminStyles,
  formatDate,
  formatMoney,
  type Tone,
} from '../parts/AdminParts';

const text = copy.admin.payments;
const statusTone: Record<PaymentStatus, Tone> = {
  pending: 'warning',
  paid: 'success',
  failed: 'danger',
  refunded: 'info',
};

export function PaymentsScreen({
  services,
  onBack,
}: {
  services: AdminServices;
  onBack(): void;
}) {
  const [status, setStatus] = useState<PaymentFilter>('all');
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const loadPackages = useCallback(
    () => services.payments.packages(),
    [services],
  );
  const packages = useResource(loadPackages);
  const loadProPlan = useCallback(
    () => services.payments.proPlan(),
    [services],
  );
  const proPlan = useResource(loadProPlan);
  const load = useCallback(
    (page: number) => services.payments.list(status, page, search),
    [services, status, search],
  );
  const list = usePagedList(load);
  const summary = list.last?.summary;
  return (
    <AdminList
      items={list.loading || list.error ? [] : list.items}
      keyOf={payment => payment.id}
      refreshing={list.refreshing || packages.refreshing || proPlan.refreshing}
      onRefresh={() => {
        packages.refresh();
        proPlan.refresh();
        list.refresh();
      }}
      onEndReached={list.loadMore}
      header={
        <>
          <BackLink label={copy.admin.common.back} onPress={onBack} />
          <PageHeader
            eyebrow={text.eyebrow}
            title={text.title}
            description={text.description}
          />
          <SectionTitle title={text.proPlan} hint={text.proPlanHint} />
          {proPlan.data ? (
            <ProPlanCard
              plan={proPlan.data}
              services={services}
              onSaved={proPlan.setData}
            />
          ) : (
            <LoadState
              loading={proPlan.loading}
              error={proPlan.error}
              onRetry={proPlan.retry}
            />
          )}
          <SectionTitle title={text.packages} hint={text.packageHint} />
          {packages.data ? (
            packages.data.map(item => (
              <PackageCard
                key={item.id}
                item={item}
                services={services}
                onSaved={updated =>
                  packages.setData(current =>
                    current
                      ? current.map(value =>
                          value.id === updated.id ? updated : value,
                        )
                      : current,
                  )
                }
              />
            ))
          ) : (
            <LoadState
              loading={packages.loading}
              error={packages.error}
              onRetry={packages.retry}
            />
          )}
          <SectionTitle title={text.history} hint={text.noCardData} />
          {summary ? (
            <View style={adminStyles.metrics}>
              <Metric
                label={text.transactions}
                value={summary.total.toLocaleString('tr-TR')}
                icon={ReceiptText}
              />
              <Metric
                label={text.filters.pending}
                value={summary.pending.toLocaleString('tr-TR')}
                icon={CreditCard}
              />
              <Metric
                label={text.collected}
                value={formatMoney(summary.collectedMinor)}
                icon={Banknote}
              />
              <Metric
                label={text.refundedAmount}
                value={formatMoney(summary.refundedMinor)}
                icon={Undo2}
              />
            </View>
          ) : null}
          <Choices<PaymentFilter>
            label={text.statusLabel}
            value={status}
            onChange={setStatus}
            options={(
              ['all', 'pending', 'paid', 'failed', 'refunded'] as const
            ).map(value => ({ value, label: text.filters[value] }))}
          />
          <Field
            label={copy.admin.common.search}
            icon={Search}
            value={draft}
            onChangeText={value => {
              setDraft(value);
              if (!value) setSearch('');
            }}
            placeholder={text.search}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => setSearch(draft.trim())}
            maxLength={120}
          />
          <LoadState
            loading={list.loading}
            error={list.error}
            onRetry={list.retry}
            empty={
              !list.loading && !list.error && !list.items.length
                ? {
                    icon: CreditCard,
                    title: text.emptyTitle,
                    body: text.emptyBody,
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
        <Card>
          <View style={adminStyles.row}>
            <View style={adminStyles.flex}>
              <Text style={adminStyles.rowTitle} numberOfLines={1}>
                {item.playerName}
              </Text>
              <Text style={adminStyles.rowMeta} numberOfLines={1}>
                {item.playerEmail}
              </Text>
            </View>
            <Text style={adminStyles.rowTitle}>
              {formatMoney(item.amountMinor)}
            </Text>
          </View>
          <View style={adminStyles.wrap}>
            <Tag
              label={text.statusLabels[item.status]}
              tone={statusTone[item.status]}
            />
            <Tag
              label={
                item.product === 'pro'
                  ? text.proLabel
                  : text.packageLabel(item.packageCredits)
              }
            />
          </View>
          <Text style={adminStyles.rowMeta}>
            {text.provider(item.provider)} · {formatDate(item.createdAt, true)}
          </Text>
          {item.providerPaymentId ? (
            <Text style={adminStyles.rowMeta} selectable>
              {item.providerPaymentId}
            </Text>
          ) : null}
        </Card>
      )}
    />
  );
}

function PackageCard({
  item,
  services,
  onSaved,
}: {
  item: PaymentPackage;
  services: AdminServices;
  onSaved(updated: PaymentPackage): void;
}) {
  const [price, setPrice] = useState(priceText(item.amountMinor));
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setPrice(priceText(item.amountMinor));
  }, [item.amountMinor]);
  async function update(amountMinor: number | null, active: boolean) {
    if (busy) return;
    setError(null);
    setNotice(null);
    setFieldError(undefined);
    if (amountMinor === null) {
      setFieldError(text.priceError);
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      onSaved(
        await services.payments.updatePackage(item.id, amountMinor, active),
      );
      setNotice(text.saved);
    } catch (failure) {
      if (failure instanceof ApiError)
        setFieldError(failure.fields.amountMinor);
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <View style={adminStyles.row}>
        <Text style={[adminStyles.rowTitle, adminStyles.flex]}>
          {text.rights(item.credits)}
        </Text>
        <Tag
          label={item.active ? text.onSale : text.offSale}
          tone={item.active ? 'success' : 'neutral'}
        />
      </View>
      <Field
        label={text.price}
        value={price}
        onChangeText={setPrice}
        error={fieldError}
        keyboardType="decimal-pad"
        maxLength={10}
        editable={!busy}
      />
      <ToggleRow
        label={text.onSale}
        hint={text.onSaleHint}
        value={item.active}
        onChange={value => update(item.amountMinor, value)}
        disabled={busy}
      />
      <SuccessNotice message={notice} />
      <ErrorBanner message={error} />
      <SmallButton
        label={text.savePackage}
        tone="brand"
        accessibilityLabel={text.rights(item.credits) + ', ' + text.savePackage}
        onPress={() => update(parsePrice(price), item.active)}
        loading={busy}
      />
    </Card>
  );
}
