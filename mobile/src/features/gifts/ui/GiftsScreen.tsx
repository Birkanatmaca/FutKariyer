import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, Gift } from 'lucide-react-native';
import { colors, space } from '../../../styles/tokens';
import { copy } from '../../../shared/lib/copy';
import { Screen } from '../../../shared/ui/Screen';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import type { GiftsService } from '../application/gifts-service';
import { useGifts } from '../application/useGifts';
import { GiftCard } from './GiftCard';

export function GiftsScreen({
  token,
  service,
  onBack,
}: {
  token: string;
  service: GiftsService;
  onBack(): void;
}) {
  const gifts = useGifts(service, token);
  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.gifts.back}
        onPress={onBack}
        style={styles.back}
      >
        <ArrowLeft size={18} color={colors.text} />
        <Text style={styles.backText}>{copy.gifts.back}</Text>
      </Pressable>
      <PageHeader
        eyebrow={copy.gifts.eyebrow}
        title={copy.gifts.title}
        hint={copy.gifts.description}
      />
      {gifts.notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {gifts.notice}
        </Text>
      ) : null}
      <ErrorBanner message={gifts.error} />
      {gifts.loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>{copy.gifts.loading}</Text>
        </View>
      ) : gifts.items.length ? (
        <View style={styles.list}>
          {gifts.items.map(gift => (
            <GiftCard
              key={gift.id}
              gift={gift}
              claiming={gifts.claimingId === gift.id}
              disabled={!!gifts.claimingId}
              onClaim={() => gifts.claim(gift.id)}
            />
          ))}
        </View>
      ) : gifts.error ? (
        <Button label={copy.form.retry} onPress={gifts.refresh} />
      ) : (
        <EmptyState
          icon={Gift}
          title={copy.gifts.listEmptyTitle}
          body={copy.gifts.listEmptyBody}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    minHeight: 40,
  },
  backText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  notice: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  loading: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  loadingText: { color: colors.secondary, fontSize: 13 },
  list: { gap: space.md },
});
