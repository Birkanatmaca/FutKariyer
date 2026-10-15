import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Eye, Sparkles, Ticket, VenetianMask } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { BackLink } from '../../../shared/ui/BackLink';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Button } from '../../../shared/ui/Button';
import { ProBadge } from '../../../shared/ui/ProBadge';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { ProService } from '../application/pro-service';
import { formatDate, formatPrice } from './format';

export function ProScreen({
  token,
  service,
  onBack,
}: {
  token: string;
  service: ProService;
  onBack(): void;
}) {
  const load = useCallback(
    () =>
      Promise.all([service.offer(token), service.status(token)]).then(
        ([offer, state]) => ({ offer, status: state.pro }),
      ),
    [service, token],
  );
  const state = useFocusedResource(load);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function buy() {
    const offer = state.data?.offer;
    if (busy || !offer?.checkoutEnabled || !offer.plan.active) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const order = await service.checkout(token, offer.plan.id);
      await Linking.openURL(order.checkoutUrl);
      setNotice(copy.pro.checkoutStarted);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }
  const data = state.data;
  const benefits = data
    ? [
        { icon: Eye, label: copy.pro.benefits.visitors },
        { icon: Sparkles, label: copy.pro.benefits.badge },
        {
          icon: Ticket,
          label: copy.pro.benefits.rights(data.offer.plan.bonusCredits),
        },
        { icon: VenetianMask, label: copy.pro.benefits.privateBrowsing },
      ]
    : [];
  return (
    <Screen>
      <BackLink label={copy.form.back} onPress={onBack} />
      <PageHeader
        eyebrow={copy.pro.eyebrow}
        title={copy.pro.title}
        hint={copy.pro.hint}
      />
      {state.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} onPress={state.retry} />
        </>
      ) : data ? (
        <>
          <View style={styles.benefits}>
            {benefits.map(({ icon: Icon, label }) => (
              <View key={label} style={styles.benefit}>
                <View style={styles.benefitIcon}>
                  <Icon size={22} color={colors.brand} />
                </View>
                <Text style={styles.benefitLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.status} accessibilityLiveRegion="polite">
            <View style={styles.statusRow}>
              {data.status.active ? <ProBadge /> : null}
              <Text style={styles.statusTitle}>
                {data.status.active ? copy.pro.active : copy.pro.inactive}
              </Text>
            </View>
            {data.status.expiresAt ? (
              <Text style={styles.helper}>
                {data.status.active
                  ? copy.pro.activeUntil(formatDate(data.status.expiresAt))
                  : copy.pro.expired(formatDate(data.status.expiresAt))}
              </Text>
            ) : null}
          </View>
          <View style={styles.offer}>
            <View style={styles.priceRow}>
              <Text style={styles.price}>
                {formatPrice(
                  data.offer.plan.amountMinor,
                  data.offer.plan.currency,
                )}
              </Text>
              <Text style={styles.period}>
                {' / ' + copy.pro.perPeriod(data.offer.plan.days)}
              </Text>
            </View>
            <Text style={styles.helper}>
              {copy.pro.renewalNote(data.offer.plan.days)}
            </Text>
            {notice ? (
              <Text accessibilityRole="alert" style={styles.notice}>
                {notice}
              </Text>
            ) : null}
            {error ? <ErrorBanner message={error} /> : null}
            <Button
              label={
                !data.offer.checkoutEnabled
                  ? copy.pro.purchaseSoon
                  : data.status.active
                  ? copy.pro.renew
                  : copy.pro.buy
              }
              loading={busy}
              disabled={!data.offer.checkoutEnabled || !data.offer.plan.active}
              onPress={buy}
            />
          </View>
          {!data.offer.plan.active ? (
            <ErrorBanner message={copy.pro.offSale} />
          ) : !data.offer.checkoutEnabled ? (
            <ErrorBanner message={copy.pro.unavailable} />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  benefits: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  benefit: {
    flexBasis: '46%',
    flexGrow: 1,
    alignItems: 'center',
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandSoft,
  },
  benefitLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  status: {
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  statusTitle: { ...type.headline, color: colors.text },
  offer: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  price: { ...type.title, ...type.number, color: colors.brand },
  period: { color: colors.secondary, fontSize: 14 },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  notice: { color: colors.success, fontSize: 13, lineHeight: 19 },
});
