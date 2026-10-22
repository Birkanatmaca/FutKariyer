import React, { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Line,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { Avatar } from '../../../shared/ui/Avatar';
import { BallMark } from '../../../shared/ui/BallMark';
import { ProBadge } from '../../../shared/ui/ProBadge';
import { Wordmark } from '../../../shared/ui/Wordmark';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, shadow, space, type } from '../../../styles/tokens';
import type { PlayerProfile } from '../domain/profile';
import type { ProfileCounts } from './PlayerProfileHeader';

// The shared image is drawn at this size (9:16, Instagram story) and captured
// at the device's pixel density.
export const SHARE_CARD = { width: 360, height: 640 };

// A night-stadium player card: floodlight from the top, pitch markings below,
// the wordmark, a ringed photo, the player's football facts and real counts.
export const ProfileShareCard = forwardRef<
  View,
  {
    fullName: string;
    profile: PlayerProfile;
    counts?: ProfileCounts | null;
    avatarUri?: string;
    isPro?: boolean;
  }
>(function ShareCard({ fullName, profile, counts, avatarUri, isPro }, ref) {
  const text = copy.playerOverview;
  const facts = [
    profile.position,
    profile.dominantFoot
      ? copy.playerProfile.feet[profile.dominantFoot] + text.footSuffix
      : '',
    profile.experienceYears > 0
      ? text.years(profile.experienceYears) + text.experienceSuffix
      : '',
  ].filter(Boolean);
  const tags = [
    profile.footballType !== 'unknown'
      ? copy.football.types[profile.footballType]
      : '',
    profile.licenseStatus === 'licensed'
      ? copy.playerProfile.licenseDeclaration +
        ': ' +
        copy.football.licenseStatuses.licensed
      : '',
  ].filter(Boolean);
  const seeking = profile.availability !== 'not_available';
  const stats = counts
    ? [
        [text.views, counts.views],
        [text.followers, counts.followers],
        [text.following, counts.following],
      ]
    : [];
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <Svg
        width={SHARE_CARD.width}
        height={SHARE_CARD.height}
        style={StyleSheet.absoluteFill}
        aria-hidden
      >
        <Defs>
          <RadialGradient id="shareFlood" cx="50%" cy="0%" r="70%">
            <Stop offset="0" stopColor={colors.floodlight} stopOpacity={0.34} />
            <Stop offset="0.45" stopColor={colors.brand} stopOpacity={0.1} />
            <Stop offset="1" stopColor={colors.bg} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="shareHalo" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.brand} stopOpacity={0.28} />
            <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect
          width={SHARE_CARD.width}
          height={SHARE_CARD.height}
          fill={colors.bg}
        />
        <Ellipse cx={180} cy={-20} rx={330} ry={420} fill="url(#shareFlood)" />
        <Circle cx={180} cy={200} r={120} fill="url(#shareHalo)" />
        <Line
          x1={0}
          y1={560}
          x2={360}
          y2={560}
          stroke={colors.pitchLine}
          strokeWidth={2}
        />
        <Circle
          cx={180}
          cy={560}
          r={64}
          fill="none"
          stroke={colors.pitchLine}
          strokeWidth={2}
        />
        <Circle cx={180} cy={560} r={4} fill={colors.pitchLine} />
        <Rect
          x={100}
          y={600}
          width={160}
          height={60}
          fill="none"
          stroke={colors.pitchLine}
          strokeWidth={2}
        />
      </Svg>
      <View style={styles.brand}>
        <Wordmark height={24} />
      </View>
      <View style={styles.photoRing}>
        <Avatar name={fullName} uri={avatarUri} size={136} />
      </View>
      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text numberOfLines={2} style={styles.name}>
            {fullName}
          </Text>
          {isPro ? <ProBadge /> : null}
        </View>
        <Text style={styles.role}>{copy.profileShare.cardRole}</Text>
        {facts.length ? (
          <Text style={styles.facts}>{facts.join(' · ')}</Text>
        ) : null}
        {tags.length ? (
          <View style={styles.tags}>
            {tags.map(tag => (
              <Text key={tag} style={styles.tag}>
                {tag}
              </Text>
            ))}
          </View>
        ) : null}
        <View style={[styles.status, seeking && styles.statusSeeking]}>
          <View
            style={[styles.statusDot, seeking && styles.statusDotSeeking]}
          />
          <Text
            style={[styles.statusText, seeking && styles.statusTextSeeking]}
          >
            {copy.playerProfile.availabilities[profile.availability]}
          </Text>
        </View>
      </View>
      {stats.length ? (
        <View style={styles.stats}>
          {stats.map(([label, value], index) => (
            <View
              key={label}
              style={[styles.stat, index > 0 && styles.statDivider]}
            >
              <Text style={styles.statValue}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.footer}>
        <BallMark size={30} />
        <Text style={styles.cta}>{copy.profileShare.cardCta}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD.width,
    height: SHARE_CARD.height,
    backgroundColor: colors.bg,
    alignItems: 'center',
    paddingTop: space.xxl,
    paddingHorizontal: space.xl,
    overflow: 'hidden',
  },
  brand: { marginBottom: space.xl },
  photoRing: {
    padding: 5,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.brand,
    backgroundColor: colors.bg,
    ...shadow.glow,
  },
  identity: { alignItems: 'center', gap: space.sm, marginTop: space.lg },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  name: {
    ...type.title,
    fontSize: 28,
    lineHeight: 34,
    color: colors.text,
    textAlign: 'center',
  },
  role: { ...type.eyebrow, color: colors.brand },
  facts: { ...type.body, color: colors.secondary, textAlign: 'center' },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
  },
  tag: {
    ...type.caption,
    color: colors.text,
    backgroundColor: colors.raised,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    overflow: 'hidden',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    backgroundColor: colors.raised,
  },
  statusSeeking: { backgroundColor: colors.brandSoft },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  statusDotSeeking: { backgroundColor: colors.brand },
  statusText: { ...type.caption, fontWeight: '700', color: colors.secondary },
  statusTextSeeking: { color: colors.brand },
  stats: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: space.xl,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  statValue: {
    ...type.title,
    ...type.number,
    color: colors.text,
  },
  statLabel: { ...type.caption, color: colors.secondary },
  footer: {
    position: 'absolute',
    bottom: space.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: space.sm,
  },
  cta: { ...type.headline, color: colors.text },
});
