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
  body: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Icon size={27} color={colors.brand} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    paddingVertical: space.xxxl,
    paddingHorizontal: space.xl,
    gap: space.lg,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.brandWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.secondary,
    textAlign: 'center',
  },
});
