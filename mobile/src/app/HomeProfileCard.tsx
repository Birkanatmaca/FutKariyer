import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  ArrowUpRight,
  Eye,
  UserCheck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react-native';
import { Button } from '../shared/ui/Button';
import { ErrorBanner } from '../shared/ui/ErrorBanner';
import { useAvatarSource } from '../shared/lib/avatar';
import { copy } from '../shared/lib/copy';
import { colors, radius, shadow, space, type } from '../styles/tokens';

type Insights = { profileViews: number; followers: number; following: number };

// One card: who you are on top, your three real counters underneath. Each
// counter has its own tint so they read apart at a glance without more text.
const metrics: {
  key: keyof Insights;
  label: string;
  icon: LucideIcon;
  tint: string;
  wash: string;
}[] = [
  {
    key: 'profileViews',
    label: copy.home.views,
    icon: Eye,
    tint: colors.accent,
    wash: colors.accentWash,
  },
  {
    key: 'followers',
    label: copy.home.followers,
    icon: UsersRound,
    tint: colors.brand,
    wash: colors.brandWash,
  },
  {
    key: 'following',
    label: copy.home.following,
    icon: UserCheck,
    tint: colors.info,
    wash: colors.infoWash,
  },
];

export function HomeProfileCard({
  name,
  initial,
  avatarUri,
  insights,
  loading,
  error,
  onProfile,
  onVisitors,
  onRetry,
}: {
  name: string;
  initial: string;
  avatarUri?: string;
  insights?: Insights;
  loading: boolean;
  error: string | null;
  onProfile(): void;
  // The views counter opens the visitors screen.
  onVisitors?(): void;
  onRetry(): void;
}) {
  const avatarSource = useAvatarSource(avatarUri);
  // A photo that fails to load falls back to the initial, not an empty ring.
  const [failedSource, setFailedSource] = useState<typeof avatarSource>();
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <View
      style={styles.card}
      onLayout={event => setSize(event.nativeEvent.layout)}
    >
      <Svg
        style={styles.glow}
        pointerEvents="none"
        width={size.width}
        height={size.height}
      >
        <Defs>
          <LinearGradient id="homeGlow" x1="1" y1="0" x2="0.3" y2="0.8">
            <Stop offset="0" stopColor={colors.brand} stopOpacity={0.18} />
            <Stop offset="0.7" stopColor={colors.brand} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#homeGlow)" />
      </Svg>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.home.profileButton}
        onPress={onProfile}
        style={({ pressed }) => [styles.top, pressed && styles.pressed]}
      >
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            {avatarSource && failedSource !== avatarSource ? (
              <Image
                source={avatarSource}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                onError={() => setFailedSource(avatarSource)}
              />
            ) : (
              <Text style={styles.initial}>{initial}</Text>
            )}
          </View>
        </View>
        <View style={styles.greeting}>
          <Text style={styles.hello}>{copy.home.hello}</Text>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={styles.name}
          >
            {name}
          </Text>
        </View>
        <View style={styles.go}>
          <ArrowUpRight size={18} color={colors.text} />
        </View>
      </Pressable>
      <View style={styles.metrics}>
        {metrics.map(({ key, label, icon: Icon, tint, wash }) => {
          const value = insights?.[key];
          const body = (
            <>
              <View style={styles.tileTop}>
                <View style={[styles.icon, { backgroundColor: wash }]}>
                  <Icon size={16} color={tint} strokeWidth={2.2} />
                </View>
                <Text style={styles.value}>
                  {loading || value === undefined
                    ? '—'
                    : value.toLocaleString('tr-TR')}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={styles.label}
              >
                {label}
              </Text>
            </>
          );
          const cell = [styles.metric];
          return key === 'profileViews' && onVisitors ? (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityHint={copy.home.viewsHint}
              onPress={onVisitors}
              style={({ pressed }) => [...cell, pressed && styles.pressed]}
            >
              {body}
            </Pressable>
          ) : (
            <View key={key} style={cell}>
              {body}
            </View>
          );
        })}
      </View>
      {error ? (
        <View style={styles.error}>
          <ErrorBanner message={error} />
          <Button label={copy.form.retry} secondary onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.lg,
    gap: space.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.layer,
  },
  glow: { position: 'absolute', top: 0, left: 0 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pressed: { opacity: 0.75 },
  avatarRing: {
    padding: 3,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,

    overflow: 'hidden',
  },
  initial: { color: colors.brand, fontSize: 22, fontWeight: '800' },
  greeting: { flex: 1, gap: 2 },
  hello: { ...type.caption, color: colors.secondary },
  name: {
    ...type.title,
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  go: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  metrics: { flexDirection: 'row', gap: space.sm },
  metric: {
    flex: 1,
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...type.number,
    color: colors.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  label: { ...type.caption, color: colors.muted },
  error: { gap: space.md },
});
