import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  ArrowUpRight,
  ClipboardList,
  FileClock,
  Newspaper,
  type LucideIcon,
} from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, shadow, space, type } from '../../../styles/tokens';
import { monogram } from '../application/club-center';
import type { ClubCenter } from '../domain/models';

type Work = Pick<
  ClubCenter,
  'pendingApplications' | 'pendingNews' | 'publishedNews'
>;

// The club's Merhaba card, built like the player's: who you are on top and
// the work waiting for the club in one slim strip underneath. A switched coach
// only gets taps for the sections the club gave them.
export function ClubHelloCard({
  name,
  avatarUri,
  subtitle,
  work,
  onProfile,
  onApplications,
  onNews,
}: {
  name: string;
  avatarUri?: string;
  // The league line, or the district when the club is in no league.
  subtitle: string;
  // Undefined while the center loads.
  work?: Work;
  onProfile?(): void;
  onApplications?(): void;
  onNews?(): void;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [failed, setFailed] = useState(false);
  const text = copy.clubHome;
  const cells: {
    key: keyof Work;
    label: string;
    short: string;
    icon: LucideIcon;
    tint: string;
    wash: string;
    onPress?(): void;
  }[] = [
    {
      key: 'pendingApplications',
      label: text.workApplications,
      short: text.workShort.applications,
      icon: ClipboardList,
      tint: colors.brand,
      wash: colors.brandWash,
      onPress: onApplications,
    },
    {
      key: 'pendingNews',
      label: text.workPendingNews,
      short: text.workShort.pendingNews,
      icon: FileClock,
      tint: colors.warning,
      wash: colors.overlay,
      onPress: onNews,
    },
    {
      key: 'publishedNews',
      label: text.workPublishedNews,
      short: text.workShort.publishedNews,
      icon: Newspaper,
      tint: colors.info,
      wash: colors.infoWash,
      onPress: onNews,
    },
  ];
  const top = (
    <>
      <View style={styles.avatarRing}>
        <View style={styles.avatar}>
          {avatarUri && !failed ? (
            <Image
              source={{ uri: avatarUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => setFailed(true)}
            />
          ) : (
            <Text style={styles.initial}>{monogram(name)}</Text>
          )}
        </View>
      </View>
      <View style={styles.greeting}>
        <Text style={styles.hello}>{copy.home.hello}</Text>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.name}>
          {name}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onProfile ? (
        <View style={styles.go}>
          <ArrowUpRight size={18} color={colors.text} />
        </View>
      ) : null}
    </>
  );
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
          <LinearGradient id="clubGlow" x1="1" y1="0" x2="0.3" y2="0.8">
            <Stop offset="0" stopColor={colors.brand} stopOpacity={0.18} />
            <Stop offset="0.7" stopColor={colors.brand} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#clubGlow)" />
      </Svg>
      {onProfile ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text.helloProfile}
          onPress={onProfile}
          style={({ pressed }) => [styles.top, pressed && styles.pressed]}
        >
          {top}
        </Pressable>
      ) : (
        <View style={styles.top}>{top}</View>
      )}
      <View style={styles.work}>
        <Text style={styles.workTitle}>
          {text.workTitle.toLocaleUpperCase('tr-TR')}
        </Text>
        <View style={styles.strip}>
          {cells.map(
            ({ key, label, short, icon: Icon, tint, wash, onPress }, index) => {
              const value = work?.[key];
              const waiting = key !== 'publishedNews' && !!value;
              return (
                <Pressable
                  key={key}
                  accessibilityRole={onPress ? 'button' : 'summary'}
                  accessibilityLabel={label + ': ' + (value ?? '—')}
                  disabled={!onPress}
                  onPress={onPress}
                  style={({ pressed }) => [
                    styles.cell,
                    index > 0 && styles.divider,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.cellTop}>
                    <View style={[styles.icon, { backgroundColor: wash }]}>
                      <Icon size={13} color={tint} strokeWidth={2.4} />
                    </View>
                    <Text
                      style={[styles.value, waiting && { color: tint }]}
                      numberOfLines={1}
                    >
                      {value === undefined
                        ? '—'
                        : value.toLocaleString('tr-TR')}
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={styles.label}>
                    {short}
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>
      </View>
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
  initial: { color: colors.brand, fontSize: 20, fontWeight: '800' },
  greeting: { flex: 1, gap: 2 },
  hello: { ...type.caption, color: colors.secondary },
  name: {
    ...type.title,
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: { ...type.caption, color: colors.muted },
  go: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  work: { gap: space.sm },
  workTitle: { ...type.eyebrow, color: colors.muted },
  strip: {
    flexDirection: 'row',
    borderRadius: radius.md,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  cell: {
    flex: 1,
    gap: space.xs,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    minHeight: 64,
    justifyContent: 'center',
  },
  divider: { borderLeftWidth: 1, borderLeftColor: colors.hairline },
  cellTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  icon: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...type.number,
    color: colors.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  label: { ...type.caption, fontSize: 11, color: colors.muted },
});
