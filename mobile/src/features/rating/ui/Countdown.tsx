import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import { splitDuration } from '../domain/models';

// Day / hour / minute / second blocks; `large` is the hero size.
export function Countdown({
  seconds,
  large = false,
}: {
  seconds: number;
  large?: boolean;
}) {
  const parts = splitDuration(seconds);
  const text = copy.rating.units;
  const blocks = [
    [parts.days, text.days],
    [parts.hours, text.hours],
    [parts.minutes, text.minutes],
    [parts.seconds, text.seconds],
  ] as const;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={copy.rating.countdownLabel(
        parts.days,
        parts.hours,
        parts.minutes,
      )}
    >
      {blocks.map(([value, label]) => (
        <View key={label} style={[styles.block, large && styles.blockLarge]}>
          <Text style={[styles.value, large && styles.valueLarge]}>
            {String(value).padStart(2, '0')}
          </Text>
          <Text style={styles.label}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  block: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  blockLarge: { paddingVertical: space.md, borderRadius: radius.md },
  value: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  valueLarge: { fontSize: 30, lineHeight: 36 },
  label: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
