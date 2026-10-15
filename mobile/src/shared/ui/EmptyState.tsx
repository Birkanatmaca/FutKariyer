import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, space } from '../../styles/tokens';
export function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  // Kept for screen readers; the card itself shows only the icon and title.
  body?: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.halo}>
        <View style={styles.icon}>
          <Icon size={28} color={colors.brand} strokeWidth={2} />
        </View>
      </View>
      <Text
        accessibilityRole="header"
        accessibilityHint={body}
        style={styles.title}
      >
        {title}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
    gap: space.lg,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  // Two rings around the icon, like a centre circle on the pitch.
  halo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: colors.pitchLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.secondary,
    textAlign: 'center',
    maxWidth: 300,
  },
});
