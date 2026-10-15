import React, { useState, type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { CircleCheck, ImageOff, type LucideIcon } from 'lucide-react-native';
import { Button } from '../../../../shared/ui/Button';
import { EmptyState } from '../../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../../shared/ui/ErrorBanner';
import { copy } from '../../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../../styles/tokens';
import type { ImageSource } from '../../domain/models';

// Layered surface with a hairline edge, the base of every admin row.
export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export type Tone =
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';
const toneColor: Record<Tone, string> = {
  brand: colors.brand,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.info,
  neutral: colors.muted,
};
// Status is always written out; the dot only reinforces it.
export function Tag({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: Tone;
}) {
  return (
    <View style={styles.tag}>
      <View style={[styles.dot, { backgroundColor: toneColor[tone] }]} />
      <Text style={[styles.tagText, { color: toneColor[tone] }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionTitle}>
      <View style={styles.flex}>
        <Text accessibilityRole="header" style={styles.sectionText}>
          {title}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {action}
    </View>
  );
}

// Top level switch between sibling lists (users/clubs, ads/news/reviews...).
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string; badge?: number | null }[];
  value: T;
  onChange(value: T): void;
  disabled?: boolean;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.segmented}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text
              numberOfLines={1}
              style={[styles.segmentText, selected && styles.segmentTextOn]}
            >
              {option.label}
            </Text>
            {option.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {option.badge > 99 ? '99+' : option.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// Single choice from a short list; the mobile counterpart of a <select>.
export function Choices<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  hint,
  disabled,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange(value: T): void;
  error?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.choices}>
        {options.map(option => {
          const checked = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={[styles.choice, checked && styles.choiceOn]}
            >
              <Text style={[styles.choiceText, checked && styles.choiceTextOn]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
  error,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange(value: boolean): void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.toggle}>
        <Text style={[styles.toggleLabel, styles.flex]}>{label}</Text>
        <Switch
          accessibilityLabel={label}
          value={value}
          disabled={disabled}
          onValueChange={onChange}
          trackColor={{ false: colors.overlay, true: colors.brand }}
          thumbColor={colors.text}
          ios_backgroundColor={colors.overlay}
        />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

// Compact pill action for list rows; the full-width Button stays the primary.
export function SmallButton({
  label,
  onPress,
  tone = 'secondary',
  disabled,
  loading,
  accessibilityLabel,
  icon: Icon,
}: {
  label: string;
  onPress(): void;
  tone?: 'brand' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  icon?: LucideIcon;
}) {
  const foreground =
    tone === 'brand'
      ? colors.brandInk
      : tone === 'danger'
      ? colors.danger
      : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{
        disabled: !!disabled || !!loading,
        busy: !!loading,
      }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.small,
        tone === 'brand' && styles.smallBrand,
        tone === 'danger' && styles.smallDanger,
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <>
          {Icon ? <Icon size={16} color={foreground} /> : null}
          <Text style={[styles.smallText, { color: foreground }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function SuccessNotice({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={styles.success}
    >
      <CircleCheck size={18} color={colors.success} />
      <Text style={styles.successText}>{message}</Text>
    </View>
  );
}

// Loading, error-with-retry and empty states for a whole list or screen.
export function LoadState({
  loading,
  error,
  onRetry,
  empty,
}: {
  loading: boolean;
  error: string | null;
  onRetry(): void;
  empty?: { icon: LucideIcon; title: string; body: string } | null;
}) {
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.hint}>{copy.form.loading}</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.stack}>
        <ErrorBanner message={error} />
        <Button label={copy.form.retry} secondary onPress={onRetry} />
      </View>
    );
  }
  return empty ? (
    <EmptyState icon={empty.icon} title={empty.title} body={empty.body} />
  ) : null;
}

export function LoadMore({
  hasMore,
  loadingMore,
  error,
  onMore,
}: {
  hasMore: boolean;
  loadingMore: boolean;
  error: string | null;
  onMore(): void;
}) {
  if (loadingMore) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  if (!hasMore) return null;
  return (
    <View style={styles.stack}>
      <ErrorBanner message={error} />
      <Button
        label={error ? copy.form.retry : copy.admin.common.loadMore}
        secondary
        onPress={onMore}
      />
    </View>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>
        {value || copy.admin.common.notEntered}
      </Text>
    </View>
  );
}

export function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <View
      accessible
      accessibilityLabel={label + ': ' + value}
      style={styles.metric}
    >
      <View style={styles.metricIcon}>
        <Icon size={16} color={colors.brand} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

// Content images may be drafts, which the server only serves to an admin
// session; the bearer header travels with the image request.
export function AdminImage({
  source,
  label,
  style,
}: {
  source: ImageSource | { uri: string } | null;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.image, style]}
    >
      {!source || failed === source.uri ? (
        <ImageOff size={22} color={colors.muted} />
      ) : (
        <Image
          source={source}
          resizeMode="cover"
          style={styles.fill}
          onError={() => setFailed(source.uri)}
        />
      )}
    </View>
  );
}

export function formatDate(value: string | null, withTime = false) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString(
    'tr-TR',
    withTime
      ? {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }
      : { day: 'numeric', month: 'short', year: 'numeric' },
  );
}
export function formatMoney(amountMinor: number) {
  return (
    (amountMinor / 100).toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' TL'
  );
}

export const adminStyles = StyleSheet.create({
  rowTitle: { ...type.headline, color: colors.text },
  rowMeta: { ...type.caption, color: colors.muted },
  rowBody: { ...type.body, color: colors.secondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    justifyContent: 'flex-end',
  },
  form: { gap: space.lg },
  flex: { flex: 1, minWidth: 0 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  avatarText: { color: colors.brand, fontSize: 16, fontWeight: '800' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});

const styles = StyleSheet.create({
  card: {
    padding: space.lg,
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  flex: { flex: 1, minWidth: 0 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  tagText: { fontSize: 11, fontWeight: '700' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sectionText: { ...type.headline, color: colors.text },
  segmented: {
    flexDirection: 'row',
    padding: space.xs,
    gap: space.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
  },
  segmentSelected: { backgroundColor: colors.brandWash },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.secondary },
  segmentTextOn: { color: colors.brand, fontWeight: '800' },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  badgeText: { color: colors.brandInk, fontSize: 10, fontWeight: '800' },
  group: { gap: space.sm },
  label: { fontSize: 12, fontWeight: '600', color: colors.secondary },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  choice: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceOn: { borderColor: colors.brand, backgroundColor: colors.brandWash },
  choiceText: { fontSize: 13, fontWeight: '600', color: colors.secondary },
  choiceTextOn: { color: colors.brand, fontWeight: '800' },
  toggle: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  error: { fontSize: 12, lineHeight: 18, color: colors.danger },
  hint: { fontSize: 12, lineHeight: 18, color: colors.muted },
  small: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  smallBrand: { backgroundColor: colors.brand, borderColor: colors.brand },
  smallDanger: {
    backgroundColor: colors.dangerWash,
    borderColor: colors.dangerWash,
  },
  smallText: { fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  success: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.brandWash,
  },
  successText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 20 },
  loading: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  stack: { gap: space.md },
  info: { gap: 2 },
  infoLabel: { ...type.caption, color: colors.muted },
  infoValue: { ...type.body, color: colors.text },
  metric: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandWash,
  },
  metricValue: {
    ...type.number,
    color: colors.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  metricLabel: { ...type.caption, color: colors.muted },
  image: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  fill: { width: '100%', height: '100%' },
});
