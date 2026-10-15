import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { UserMinus } from 'lucide-react-native';
import { colors, radius, space } from '../../../styles/tokens';

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('tr-TR');

// One squad member or membership with its destructive action.
export function RosterCard({
  title,
  lines,
  actionLabel,
  busy,
  disabled,
  onAction,
}: {
  title: string;
  lines: string[];
  actionLabel: string;
  busy: boolean;
  disabled: boolean;
  onAction(): void;
}) {
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>
        {title}
      </Text>
      {lines.map(line => (
        <Text key={line} style={styles.meta}>
          {line}
        </Text>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel + ': ' + title}
        accessibilityState={{ disabled: disabled || busy, busy }}
        disabled={disabled || busy}
        onPress={onAction}
        style={[styles.action, (disabled || busy) && styles.disabled]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.danger} />
        ) : (
          <UserMinus size={15} color={colors.danger} />
        )}
        <Text style={styles.actionText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  action: {
    alignSelf: 'flex-start',
    minHeight: 42,
    marginTop: space.xs,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    gap: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.dangerWash,
    backgroundColor: colors.raised,
  },
  actionText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
