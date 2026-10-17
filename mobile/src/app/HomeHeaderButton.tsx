import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, space } from '../styles/tokens';

// Round shortcut in the home header; the optional count shows as a lime badge.
export function HomeHeaderButton({
  icon: Icon,
  label,
  hint,
  count = 0,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  count?: number;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon size={20} color={colors.brand} strokeWidth={2} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: space.xs,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  badgeText: { color: colors.brandInk, fontSize: 11, fontWeight: '800' },
});
