import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ChevronRight } from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { RatingBoard } from '../domain/models';
import { Countdown } from './Countdown';
import { RatingTrophy } from './RatingTrophy';

// Top of the games lobby: the season, its countdown and the account's place.
export function RatingBanner({
  board,
  remaining,
  onOpen,
}: {
  board: RatingBoard | null;
  remaining: number;
  onOpen(): void;
}) {
  const text = copy.rating;
  const season = board?.season ?? null;
  const me = board?.me ?? null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text.open}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="ratingBanner" x1="1" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.brand} stopOpacity={0.22} />
            <Stop offset="0.7" stopColor={colors.brand} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#ratingBanner)" />
      </Svg>
      <View style={styles.top}>
        <View style={styles.titles}>
          <Text style={styles.eyebrow}>{text.eyebrow}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {season ? season.title : text.noSeasonTitle}
          </Text>
          {season ? (
            <Text style={styles.caption}>
              {season.status === 'upcoming'
                ? text.startsIn
                : season.status === 'active'
                ? text.endsIn
                : text.finished}
            </Text>
          ) : (
            <Text style={styles.caption}>{text.noSeasonBody}</Text>
          )}
        </View>
        <RatingTrophy size={92} />
      </View>
      {season && season.status !== 'finished' ? (
        <Countdown seconds={remaining} />
      ) : null}
      <View style={styles.footer}>
        {season && season.status !== 'upcoming' && me ? (
          <View style={styles.me}>
            <Text style={styles.meRank}>{me.rank ? '#' + me.rank : '—'}</Text>
            <Text style={styles.mePoints}>{text.points(me.points)}</Text>
          </View>
        ) : (
          <View />
        )}
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{text.bannerCta}</Text>
          <ChevronRight size={16} color={colors.brand} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.88 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  titles: { flex: 1, gap: space.xs },
  eyebrow: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  caption: { color: colors.secondary, fontSize: 12, lineHeight: 17 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  me: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  meRank: { color: colors.text, fontSize: 18, fontWeight: '800' },
  mePoints: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  ctaText: { color: colors.brand, fontSize: 12, fontWeight: '800' },
});
