import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ticket } from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, shadow, space, type } from '../../../styles/tokens';

// Compact balance pill (ticket icon + number) for the Takımlar header.
export function RightsBadge({
  count,
  onPress,
}: {
  count: number;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.teams.rightsBadge(count)}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <Ticket size={18} color={colors.brandInk} strokeWidth={2.2} />
      <Text style={styles.count}>{count > 999 ? '999+' : count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    ...shadow.glow,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  count: {
    ...type.number,
    color: colors.brandInk,
    fontSize: 17,
    fontWeight: '900',
  },
});
