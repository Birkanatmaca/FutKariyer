import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';
import { colors, radius, space } from '../../styles/tokens';

type Props = {
  label: string;
  onPress(): void;
  loading?: boolean;
  secondary?: boolean;
  accessibilityLabel?: string;
};
export function Button({
  label,
  onPress,
  loading,
  secondary,
  accessibilityLabel,
}: Props) {
  const foreground = secondary ? colors.text : colors.brandInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!loading, busy: !!loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        pressed && styles.pressed,
        loading && styles.loading,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          <Text style={[styles.label, { color: foreground }]}>{label}</Text>
          <ArrowUpRight size={20} color={foreground} strokeWidth={2} />
        </>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  secondary: {
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  loading: { justifyContent: 'center' },
});
