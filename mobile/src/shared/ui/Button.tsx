import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';
import { colors, radius, shadow, space } from '../../styles/tokens';

type Props = {
  label: string;
  onPress(): void;
  loading?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  // A slimmer, centred button without the arrow (sign-in and sign-up).
  compact?: boolean;
  accessibilityLabel?: string;
};
export function Button({
  label,
  onPress,
  loading,
  disabled,
  secondary,
  compact,
  accessibilityLabel,
}: Props) {
  const foreground = secondary ? colors.text : colors.brandInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{
        disabled: !!loading || !!disabled,
        busy: !!loading,
      }}
      disabled={loading || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        compact && styles.compact,
        pressed && styles.pressed,
        loading && styles.loading,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          <Text
            style={[
              styles.label,
              compact && styles.compactLabel,
              { color: foreground },
            ]}
          >
            {label}
          </Text>
          {compact ? null : (
            <ArrowUpRight size={20} color={foreground} strokeWidth={2} />
          )}
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
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    ...shadow.glow,
  },
  secondary: {
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.hairline,
    shadowOpacity: 0,
    elevation: 0,
  },
  label: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  compact: {
    minHeight: 50,
    paddingVertical: space.md,
    justifyContent: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
  compactLabel: { fontSize: 15, fontWeight: '700', letterSpacing: 0 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  loading: { justifyContent: 'center' },
  disabled: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
});
