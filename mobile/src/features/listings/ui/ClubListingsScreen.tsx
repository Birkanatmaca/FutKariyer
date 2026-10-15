import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Megaphone, CircleX } from 'lucide-react-native';
import { confirmAction } from '../../connections';
import { BackLink } from '../../../shared/ui/BackLink';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Screen } from '../../../shared/ui/Screen';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import type { ListingsService } from '../application/listings-service';
import {
  maxOpenListings,
  type CreatedListing,
  type Listing,
} from '../domain/models';
import { ListingForm } from './ListingForm';
import { formatDate } from './ListingParts';

const text = copy.listings;

export function ClubListingsScreen({
  token,
  service,
  onBack,
}: {
  token: string;
  service: ListingsService;
  onBack(): void;
}) {
  const state = useFocusedResource(
    useCallback(() => service.mine(token), [service, token]),
  );
  const [composing, setComposing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const openCount =
    state.data?.filter(item => item.status === 'open').length ?? 0;

  function created(result: CreatedListing) {
    setComposing(false);
    setError('');
    setNotice(text.published + ' ' + text.notified(result.notifiedPlayers));
    state.retry();
  }

  async function close(listing: Listing) {
    if (busyId) return;
    const confirmed = await confirmAction(
      text.closeTitle,
      text.closeBody(listing.title),
      text.close,
    );
    if (!confirmed) return;
    setBusyId(listing.id);
    setError('');
    setNotice('');
    try {
      await service.close(token, listing.id);
      setNotice(text.closed);
      state.retry();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusyId('');
    }
  }

  return (
    <Screen>
      <BackLink label={copy.form.back} onPress={onBack} />
      <PageHeader
        eyebrow={text.mineEyebrow}
        title={text.mineTitle}
        hint={text.mineDescription}
      />
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      <ErrorBanner message={error} />
      {composing ? (
        <ListingForm
          token={token}
          service={service}
          onCreated={created}
          onCancel={() => setComposing(false)}
        />
      ) : (
        <Button
          label={text.newListing}
          onPress={() => {
            setNotice('');
            setComposing(true);
          }}
        />
      )}
      {state.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} secondary onPress={state.retry} />
        </>
      ) : state.data?.length ? (
        <View style={styles.list}>
          <Text style={styles.count}>
            {text.openCount(openCount, maxOpenListings)}
          </Text>
          {state.data.map(listing => (
            <OwnListingCard
              key={listing.id}
              listing={listing}
              busy={busyId === listing.id}
              disabled={!!busyId}
              onClose={() => close(listing)}
            />
          ))}
        </View>
      ) : state.data ? (
        <EmptyState
          icon={Megaphone}
          title={text.mineEmptyTitle}
          body={text.mineEmptyBody}
        />
      ) : null}
    </Screen>
  );
}

function OwnListingCard({
  listing,
  busy,
  disabled,
  onClose,
}: {
  listing: Listing;
  busy: boolean;
  disabled: boolean;
  onClose(): void;
}) {
  const open = listing.status === 'open';
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text numberOfLines={2} style={styles.title}>
          {listing.title}
        </Text>
        <View style={[styles.status, open && styles.statusOpen]}>
          <Text style={[styles.statusText, open && styles.statusTextOpen]}>
            {text.status[listing.status]}
          </Text>
        </View>
      </View>
      <Text style={styles.position}>{listing.position || text.noPosition}</Text>
      <Text style={styles.meta}>
        {text.applications(listing.applications ?? 0)} ·{' '}
        {text.publishedAt(formatDate(listing.createdAt))}
      </Text>
      {listing.closedAt ? (
        <Text style={styles.meta}>
          {text.closedAt(formatDate(listing.closedAt))}
        </Text>
      ) : null}
      {open ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text.close + ': ' + listing.title}
          accessibilityState={{ disabled: disabled || busy, busy }}
          disabled={disabled || busy}
          onPress={onClose}
          style={[styles.action, (disabled || busy) && styles.disabled]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <CircleX size={15} color={colors.danger} />
          )}
          <Text style={styles.actionText}>{text.close}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { color: colors.success, fontSize: 13, lineHeight: 19 },
  list: { gap: space.md },
  count: { color: colors.brand, fontSize: 13, fontWeight: '700' },
  card: {
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  title: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  status: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusOpen: { borderColor: colors.brand, backgroundColor: colors.brandWash },
  statusText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  statusTextOpen: { color: colors.brand },
  position: { color: colors.secondary, fontSize: 13, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  action: {
    alignSelf: 'flex-start',
    minHeight: 42,
    marginTop: space.xs,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    gap: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.dangerWash,
    backgroundColor: colors.raised,
  },
  actionText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
