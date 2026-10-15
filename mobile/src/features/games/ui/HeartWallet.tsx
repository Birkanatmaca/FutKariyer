import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clock3, Heart } from 'lucide-react-native';
import { colors, radius, space } from '../../../styles/tokens';
import { copy } from '../../../shared/lib/copy';
export function HeartWallet({
  hearts,
  remaining,
  compact = false,
}: {
  hearts: number;
  remaining: number;
  compact?: boolean;
}) {
  const time = [
    Math.floor(remaining / 3600),
    Math.floor((remaining % 3600) / 60),
    remaining % 60,
  ]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
  return (
    <View style={[styles.card, compact && styles.compact]}>
      {!compact ? (
        <Text style={styles.label}>{copy.games.heartTitle}</Text>
      ) : null}
      <View
        accessibilityLabel={copy.games.heartLabel(hearts)}
        style={styles.hearts}
      >
        {[0, 1, 2].map(i => (
          <Heart
            key={i}
            size={compact ? 20 : 28}
            strokeWidth={1.8}
            color={i < hearts ? colors.danger : colors.muted}
            fill={i < hearts ? colors.danger : colors.transparent}
          />
        ))}
        {compact ? <Text style={styles.count}>{hearts}/3</Text> : null}
      </View>
      {!compact ? (
        <>
          <View style={styles.timer}>
            <Clock3
              size={13}
              color={hearts === 3 ? colors.brand : colors.secondary}
            />
            <Text style={styles.time}>
              {hearts === 3
                ? copy.games.fullHearts
                : copy.games.nextHeart(time)}
            </Text>
          </View>
          <Text style={styles.hint}>{copy.games.refillHelp}</Text>
        </>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.md,
  },
  compact: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  label: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  hearts: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  count: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: space.xs,
  },
  timer: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  time: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
});
