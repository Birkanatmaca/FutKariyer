import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MapPin, Megaphone } from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import type { ListingsService } from '../application/listings-service';
import {
  applyErrorMessage,
  isFinalApplyError,
} from '../application/validation';
import type { TeamQuota } from '../../teams';
import { formatDate } from './ListingParts';

const text = copy.listings;

export function ListingDetailScreen({
  token,
  id,
  service,
  canApply,
  onBack,
}: {
  token: string;
  id: string;
  service: ListingsService;
  // Only player accounts can apply; coaches and clubs browse.
  canApply: boolean;
  onBack(): void;
}) {
  const state = useFocusedResource(
    useCallback(() => service.detail(token, id), [service, token, id]),
  );
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<TeamQuota | null>(null);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);

  async function apply() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await service.apply(token, id);
      setQuota(result.quota);
    } catch (failure) {
      setError(applyErrorMessage(failure));
      setBlocked(isFinalApplyError(failure));
    } finally {
      setBusy(false);
    }
  }

  const listing = state.data;
  return (
    <Screen>
      <TopBar title={text.title} onBack={onBack} backLabel={text.detailBack} />
      {state.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} onPress={state.retry} />
        </>
      ) : listing ? (
        <>
          <View style={styles.hero}>
            <View style={styles.badge}>
              <Megaphone size={26} color={colors.brand} />
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              {listing.title}
            </Text>
            <Text style={styles.club}>{listing.clubName}</Text>
            <View style={styles.metaRow}>
              <MapPin size={14} color={colors.secondary} />
              <Text style={styles.meta}>
                {listing.district || text.noDistrict}
                {listing.footballType !== 'unknown'
                  ? ' · ' + copy.football.types[listing.footballType]
                  : ''}
              </Text>
            </View>
            <Text style={styles.meta}>
              {text.publishedAt(formatDate(listing.createdAt))}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{text.position}</Text>
            <Text style={styles.position}>
              {listing.position || text.noPosition}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{text.about}</Text>
            <Text style={styles.body}>
              {listing.description || text.noDescription}
            </Text>
          </View>
          {canApply ? (
            <View style={styles.apply}>
              <Text style={styles.help}>{text.applyHelp}</Text>
              {quota ? (
                <View accessibilityRole="alert" style={styles.done}>
                  <Text style={styles.success}>{text.applied}</Text>
                  <Text style={styles.remaining}>
                    {text.remaining(quota.remaining, quota.limit)}
                  </Text>
                </View>
              ) : blocked ? null : (
                <Button
                  label={busy ? text.applying : text.apply}
                  loading={busy}
                  onPress={apply}
                />
              )}
              <ErrorBanner message={error} />
            </View>
          ) : (
            <Text style={styles.help}>{text.browseOnly}</Text>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  club: { color: colors.secondary, fontSize: 15, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  card: {
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  position: { color: colors.brand, fontSize: 15, fontWeight: '700' },
  body: { color: colors.secondary, fontSize: 13, lineHeight: 21 },
  apply: { gap: space.md },
  help: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  done: {
    padding: space.lg,
    gap: space.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  success: { color: colors.success, fontSize: 14, fontWeight: '700' },
  remaining: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
