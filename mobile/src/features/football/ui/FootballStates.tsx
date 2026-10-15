import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RefreshCw, Trophy } from 'lucide-react-native';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { FootballError } from '../application/useFootballResource';

const text = copy.footballData;

export const clock = (value: string) =>
  new Date(value).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
// e.g. "12 Ekim 2026 Pazartesi"
export const matchDay = (value: string) =>
  new Date(value).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });

export function LoadingBlock({ label = text.loading }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.brand} />
      <Text style={styles.helper}>{label}</Text>
    </View>
  );
}

export function ErrorBlock({
  error,
  onRetry,
}: {
  error: FootballError;
  onRetry(): void;
}) {
  return (
    <View style={styles.error}>
      <ErrorBanner message={error.message} />
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
      >
        <RefreshCw size={16} color={colors.brand} />
        <Text style={styles.retryText}>{copy.form.retry}</Text>
      </Pressable>
    </View>
  );
}

export function EmptyBlock({ body }: { body: string }) {
  return <EmptyState icon={Trophy} title={text.emptyTitle} body={body} />;
}

export function UpdatedLabel({ at }: { at: string }) {
  return <Text style={styles.helper}>{text.updatedAt(clock(at))}</Text>;
}

export function SectionTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.section}>
      <Text
        accessibilityRole="header"
        accessibilityHint={description}
        style={styles.sectionTitle}
      >
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  helper: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  error: { gap: space.md },
  retry: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
  retryText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  pressed: { opacity: 0.82 },
  section: { gap: space.xs },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
