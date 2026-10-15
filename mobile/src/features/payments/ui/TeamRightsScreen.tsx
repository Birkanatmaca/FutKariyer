import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, ShoppingBag } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import { createPaymentsService } from '../application/payment-service';
import { paymentsRepository } from '../data/http-payments-repository';

const service = createPaymentsService(paymentsRepository);

export function TeamRightsScreen({
  token,
  onBack,
}: {
  token: string;
  onBack(): void;
}) {
  const load = useCallback(() => service.packages(token), [token]);
  const state = useFocusedResource(load);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const formatPrice = (amountMinor: number, currency: string) =>
    new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
    }).format(amountMinor / 100);
  async function purchase(packageId: string) {
    if (busy || !state.data?.checkoutEnabled) return;
    setBusy(packageId);
    setError('');
    setNotice('');
    try {
      const order = await service.createOrder(token, packageId);
      await Linking.openURL(order.checkoutUrl);
      setNotice(copy.payments.checkoutStarted);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy('');
    }
  }
  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.payments.back}
        onPress={onBack}
        style={styles.back}
      >
        <ArrowLeft size={18} color={colors.text} />
        <Text style={styles.backText}>{copy.payments.back}</Text>
      </Pressable>
      <PageHeader
        eyebrow={copy.payments.eyebrow}
        title={copy.payments.title}
        hint={copy.payments.description}
      />
      <View style={styles.included}>
        <Text style={styles.includedTitle}>{copy.payments.included}</Text>
        <Text style={styles.helper}>{copy.teams.quotaHelp}</Text>
      </View>
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      {state.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} onPress={state.retry} />
        </>
      ) : state.data?.items.length ? (
        state.data.items.map(item => (
          <View key={item.id} style={styles.packageCard}>
            <View style={styles.packageIcon}>
              <ShoppingBag size={22} color={colors.brand} />
            </View>
            <View style={styles.packageDetails}>
              <Text style={styles.packageTitle}>
                {copy.payments.rights(item.credits)}
              </Text>
              <Text style={styles.price}>
                {formatPrice(item.amountMinor, item.currency)}
              </Text>
            </View>
            <Button
              label={
                state.data?.checkoutEnabled
                  ? copy.payments.buyNow
                  : copy.payments.purchase
              }
              loading={busy === item.id}
              disabled={!state.data?.checkoutEnabled || !!busy}
              onPress={() => purchase(item.id)}
            />
          </View>
        ))
      ) : (
        <View style={styles.empty}>
          <Text style={styles.packageTitle}>{copy.payments.empty}</Text>
          <Text style={styles.helper}>{copy.payments.emptyBody}</Text>
        </View>
      )}
      {!state.loading && !state.error && !state.data?.checkoutEnabled ? (
        <ErrorBanner message={copy.payments.unavailable} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingRight: space.md,
  },
  backText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  included: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
    padding: space.lg,
    gap: space.sm,
  },
  includedTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  packageIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  packageDetails: { flex: 1, gap: space.xs },
  packageTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  price: { color: colors.brand, fontSize: 14, fontWeight: '800' },
  notice: { color: colors.success, fontSize: 13, lineHeight: 19 },
  empty: {
    padding: space.xl,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: space.sm,
  },
});
