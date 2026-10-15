import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../../../styles/tokens';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import type { Gift } from '../domain/models';

export function GiftCard({
  gift,
  claiming,
  disabled,
  onClaim,
}: {
  gift: Gift;
  claiming: boolean;
  disabled: boolean;
  onClaim(): void;
}) {
  const available = gift.status === 'available';
  const dateLine =
    gift.status === 'claimed' && gift.claimedAt
      ? copy.gifts.claimedOn(gift.claimedAt)
      : copy.gifts.expires(gift.expiresAt);
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.kind}>
          <Text style={styles.kindText}>{copy.gifts.kinds[gift.kind]}</Text>
        </View>
        <Text
          style={[
            styles.status,
            available && styles.available,
            gift.status === 'claimed' && styles.claimed,
          ]}
        >
          {copy.gifts.statuses[gift.status]}
        </Text>
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {gift.title}
      </Text>
      <Text style={styles.message}>{gift.message}</Text>
      <Text style={styles.date}>{dateLine}</Text>
      {available ? (
        <Button
          label={copy.gifts.claim}
          loading={claiming}
          disabled={disabled}
          onPress={onClaim}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  kind: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
  },
  kindText: { color: colors.secondary, fontSize: 11, fontWeight: '700' },
  status: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  available: { color: colors.brand },
  claimed: { color: colors.success },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  message: { color: colors.secondary, fontSize: 13, lineHeight: 20 },
  date: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
