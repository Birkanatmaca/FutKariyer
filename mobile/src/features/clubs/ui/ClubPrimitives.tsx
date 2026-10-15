import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';

export function ClubSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onPress(): void };
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={title + ': ' + action.label}
            onPress={action.onPress}
            style={styles.link}
          >
            <Text style={styles.linkText}>{action.label}</Text>
            <ChevronRight size={16} color={colors.brand} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

// Shows the loading spinner or the error with a retry action; renders nothing otherwise.
export function SectionStatus({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry(): void;
}) {
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.muted}>{copy.clubHome.loading}</Text>
      </View>
    );
  }
  if (error) {
    return (
      <>
        <ErrorBanner message={error} />
        <Button label={copy.form.retry} secondary onPress={onRetry} />
      </>
    );
  }
  return null;
}

// Used by section loaders when the session token is missing.
export const sessionError = (): Promise<never> =>
  Promise.reject(new Error(copy.playerProfile.sessionError));

export function BackLink({
  label,
  onPress,
}: {
  label: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.back}
    >
      <ArrowLeft size={18} color={colors.text} />
      <Text style={styles.backText}>{label}</Text>
    </Pressable>
  );
}

export function EmptyText({ children }: { children: string }) {
  return <Text style={styles.muted}>{children}</Text>;
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: space.sm,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: '700', flexShrink: 1 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 44,
  },
  linkText: { color: colors.brand, fontSize: 12, fontWeight: '600' },
  loading: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  back: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingRight: space.md,
  },
  backText: { color: colors.text, fontSize: 13, fontWeight: '700' },
});

export const clubStyles = StyleSheet.create({
  card: {
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
});
