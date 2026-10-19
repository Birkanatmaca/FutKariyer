import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { copy } from '../lib/copy';
import { colors, radius } from '../../styles/tokens';

// Header of a pushed screen: Back at the top left, the screen title centred
// and an optional compact control (e.g. a balance badge) at the top right.
export function TopBar({
  title,
  onBack,
  backLabel = copy.form.back,
  accessory,
}: {
  title: string;
  onBack?(): void;
  backLabel?: string;
  accessory?: React.ReactNode;
}) {
  return (
    <View style={styles.bar}>
      <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <ChevronLeft size={24} color={colors.text} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.side, styles.right]}>{accessory}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Absolutely centred so the title stays in the middle whatever the sides hold.
  title: {
    position: 'absolute',
    left: 56,
    right: 56,
    textAlign: 'center',
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  side: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
