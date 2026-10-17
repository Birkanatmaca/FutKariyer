import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clock3 } from 'lucide-react-native';
import { colors, radius, space } from '../../../styles/tokens';
import { copy } from '../../../shared/lib/copy';
import { playsLeft, type PlayCount } from '../domain/models';

export function countdown(seconds: number) {
  return [
    Math.floor(seconds / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}

// Today's plays for one game as pips, plus the time to the midnight reset.
export function PlaysMeter({
  plays,
  remaining,
  compact = false,
}: {
  plays: PlayCount;
  remaining: number;
  compact?: boolean;
}) {
  const left = playsLeft(plays);
  return (
    <View
      style={[styles.card, compact && styles.compact]}
      accessible
      accessibilityLabel={copy.games.playsLabel(left, plays.limit)}
    >
      {!compact ? (
        <Text style={styles.label}>{copy.games.playsTitle}</Text>
      ) : null}
      <View style={styles.row}>
        <View style={styles.pips}>
          {Array.from({ length: plays.limit }, (_, i) => (
            <View
              key={i}
              style={[
                styles.pip,
                i < left && styles.pipOn,
                compact && styles.pipSmall,
              ]}
            />
          ))}
        </View>
        <Text style={styles.count}>
          {copy.games.playsLeft(left, plays.limit)}
        </Text>
      </View>
      {!compact ? (
        <View style={styles.timer}>
          <Clock3 size={13} color={left ? colors.brand : colors.secondary} />
          <Text style={styles.time}>
            {copy.games.resetIn(countdown(remaining))}
          </Text>
        </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pips: { flexDirection: 'row', gap: space.xs },
  pip: {
    width: 18,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
  },
  pipSmall: { width: 10, height: 6 },
  pipOn: { backgroundColor: colors.brand },
  count: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timer: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  time: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
