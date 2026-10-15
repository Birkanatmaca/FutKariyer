import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CircleQuestionMark,
  Goal,
  ShieldHalf,
  Swords,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, shadow, space, type } from '../../../styles/tokens';
import { copy } from '../../../shared/lib/copy';

export type GameArt = 'crest' | 'spot' | 'faceoff';

// A small drawn scene per game so the three cards read apart at a glance.
function Art({ art }: { art: GameArt }) {
  const Icon: LucideIcon =
    art === 'crest' ? ShieldHalf : art === 'spot' ? Goal : Swords;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.art}
    >
      <View style={styles.pitchLine} />
      {art === 'crest' ? (
        <View style={styles.trail}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.crestDot, i === 2 && styles.lit]} />
          ))}
        </View>
      ) : null}
      {art === 'faceoff' ? (
        <View style={styles.pair}>
          <View style={[styles.badge, styles.lit]} />
          <View style={styles.badge} />
        </View>
      ) : null}
      <View style={styles.iconRing}>
        <Icon size={28} color={colors.brand} />
      </View>
      {art === 'spot' ? <View style={styles.spot} /> : null}
    </View>
  );
}

export function GameCard({
  name,
  tagline,
  hint,
  art,
  meta,
  metaIcon: MetaIcon,
  badge,
  disabled,
  onPress,
  onRules,
}: {
  name: string;
  tagline: string;
  hint: string;
  art: GameArt;
  meta?: string;
  metaIcon?: LucideIcon;
  badge?: string;
  disabled?: boolean;
  onPress(): void;
  onRules(): void;
}) {
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityHint={hint}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <Art art={art} />
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          <Text numberOfLines={1} style={styles.tagline}>
            {tagline}
          </Text>
          {meta || badge ? (
            <View style={styles.metaRow}>
              {meta ? (
                <View style={styles.pill}>
                  {MetaIcon ? (
                    <MetaIcon size={12} color={colors.secondary} />
                  ) : null}
                  <Text style={styles.pillText}>{meta}</Text>
                </View>
              ) : null}
              {badge ? (
                <View style={[styles.pill, styles.badgePill]}>
                  <Text style={[styles.pillText, styles.badgeText]}>
                    {badge}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.games.rulesFor(name)}
        hitSlop={8}
        onPress={onRules}
        style={styles.help}
      >
        <CircleQuestionMark size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.md,
    paddingRight: space.xxl + space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.layer,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.55 },
  art: {
    width: 92,
    height: 92,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.pitchLine,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pitchLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: colors.pitchLine,
  },
  iconRing: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trail: {
    position: 'absolute',
    top: space.sm,
    flexDirection: 'row',
    gap: space.xs,
  },
  crestDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
  },
  lit: { backgroundColor: colors.text },
  pair: {
    position: 'absolute',
    left: space.sm,
    right: space.sm,
    bottom: space.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  badge: {
    width: 14,
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
  },
  spot: {
    position: 'absolute',
    bottom: space.sm,
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  info: { flex: 1, gap: space.xs },
  name: { color: colors.text, ...type.headline, fontSize: 19 },
  tagline: { color: colors.secondary, fontSize: 12, lineHeight: 17 },
  metaRow: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
  },
  pillText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '700',
    ...type.number,
  },
  badgePill: { backgroundColor: colors.brandWash },
  badgeText: { color: colors.brand },
  help: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
