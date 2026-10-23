import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import {
  BadgeCheck,
  Pencil,
  Share,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { PlayerProfile } from '../domain/profile';

// The owner's real network counts; other players' profiles show football
// facts in their place.
export type ProfileCounts = {
  views: number;
  followers: number;
  following: number;
  // Someone else's profile shows their post count where the owner sees views.
  posts?: number;
};
import { ProBadge } from '../../../shared/ui/ProBadge';

export function PlayerProfileHeader({
  fullName,
  profile,
  avatarSource,
  onEdit,
  onShare,
  counts,
  isPro = false,
  verified = false,
  actions,
  onFollowers,
  onFollowing,
}: {
  fullName: string;
  profile: PlayerProfile;
  counts?: ProfileCounts | null;
  isPro?: boolean;
  avatarSource?: ImageSourcePropType;
  onEdit?(): void;
  // Opens the share sheet; an icon-only button beside Profili düzenle.
  onShare?(): void;
  verified?: boolean;
  // Someone else's profile: follow and other buttons in place of Düzenle.
  actions?: React.ReactNode;
  // Tapping the follower and following counts opens the lists (23 Oct 2026).
  onFollowers?(): void;
  onFollowing?(): void;
}) {
  const [failedSource, setFailedSource] = useState<ImageSourcePropType | null>(
    null,
  );
  const initials = fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toLocaleUpperCase('tr-TR');
  const stats = [
    [
      copy.playerOverview.position,
      profile.position || copy.playerOverview.unspecified,
    ],
    [
      copy.playerProfile.foot,
      profile.dominantFoot
        ? copy.playerProfile.feet[profile.dominantFoot]
        : copy.playerOverview.unspecified,
    ],
    [
      copy.playerOverview.experience,
      copy.playerOverview.years(profile.experienceYears),
    ],
  ];
  // With counts the top row reads like Instagram (views, followers,
  // following) and the football facts move into one bio line.
  const top = counts
    ? [
        counts.posts !== undefined
          ? [copy.playerOverview.postCount, String(counts.posts)]
          : [copy.playerOverview.views, String(counts.views)],
        [copy.playerOverview.followers, String(counts.followers)],
        [copy.playerOverview.following, String(counts.following)],
      ]
    : stats;
  const facts = [
    profile.position,
    profile.dominantFoot
      ? copy.playerProfile.feet[profile.dominantFoot] +
        copy.playerOverview.footSuffix
      : '',
    profile.experienceYears > 0
      ? copy.playerOverview.years(profile.experienceYears) +
        copy.playerOverview.experienceSuffix
      : '',
  ].filter(Boolean);
  const VisibilityIcon = profile.discoverable ? Eye : EyeOff;
  const availabilityColor =
    profile.availability === 'not_available' ? colors.secondary : colors.brand;
  return (
    <View style={styles.header}>
      <View style={styles.top}>
        <View style={styles.ring}>
          <View
            style={styles.avatar}
            accessibilityLabel={copy.playerOverview.avatar(fullName)}
            accessibilityRole="image"
          >
            {avatarSource && failedSource !== avatarSource ? (
              <Image
                source={avatarSource}
                resizeMode="cover"
                style={styles.photo}
                onError={() => setFailedSource(avatarSource)}
              />
            ) : (
              <Text style={styles.initials}>{initials}</Text>
            )}
          </View>
        </View>
        <View style={styles.stats}>
          {top.map(([label, value], index) => {
            const onPress = counts
              ? index === 1
                ? onFollowers
                : index === 2
                ? onFollowing
                : undefined
              : undefined;
            return (
              <Pressable
                key={label}
                disabled={!onPress}
                onPress={onPress}
                style={styles.stat}
                accessible
                accessibilityRole={onPress ? 'button' : undefined}
                accessibilityLabel={value + ' ' + label}
              >
                <Text style={[styles.statValue, counts && styles.countValue]}>
                  {value}
                </Text>
                <Text style={[styles.statLabel, counts && styles.countLabel]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text accessibilityRole="header" style={styles.name}>
            {fullName}
          </Text>
          {verified ? (
            <BadgeCheck
              accessibilityLabel={copy.social.verified}
              size={17}
              color={colors.accent}
            />
          ) : null}
          {isPro ? <ProBadge /> : null}
        </View>
        <Text style={styles.role}>{copy.roles.player}</Text>
        {counts && facts.length ? (
          <Text style={styles.bio}>{facts.join(' · ')}</Text>
        ) : null}
        <View style={styles.tags}>
          <Text style={styles.tag}>
            {copy.football.types[profile.footballType]}
          </Text>
          {profile.licenseStatus !== 'unknown' ? (
            <Text style={styles.tag}>
              {copy.playerProfile.licenseDeclaration}:{' '}
              {copy.football.licenseStatuses[profile.licenseStatus]}
            </Text>
          ) : null}
        </View>
        <View style={styles.status}>
          <View
            style={[styles.statusDot, { backgroundColor: availabilityColor }]}
          />
          <Text style={[styles.statusText, { color: availabilityColor }]}>
            {copy.playerProfile.availabilities[profile.availability]}
          </Text>
        </View>
        {profile.currentClub ? (
          <View style={styles.club}>
            <Shield size={15} color={colors.muted} />
            <Text style={styles.clubText}>
              {profile.currentClub}
              <Text style={styles.claim}>
                {' · ' + copy.playerOverview.clubClaim}
              </Text>
            </Text>
          </View>
        ) : null}
      </View>
      {!onEdit && actions ? actions : null}
      {onEdit && (
        <>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onEdit}
              style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
            >
              <Pencil size={16} color={colors.text} />
              <Text style={styles.editText}>{copy.playerOverview.edit}</Text>
            </Pressable>
            {onShare ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.profileShare.open}
                onPress={onShare}
                style={({ pressed }) => [
                  styles.share,
                  pressed && styles.pressed,
                ]}
              >
                <Share size={18} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.visibility}>
            <VisibilityIcon size={14} color={colors.muted} />
            <Text style={styles.visibilityText}>
              {profile.discoverable
                ? copy.playerOverview.visible
                : copy.playerOverview.hidden}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  header: { gap: space.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  ring: {
    padding: 3,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  initials: { color: colors.text, fontSize: 28, fontWeight: '700' },
  stats: {
    flex: 1,
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
  },
  stat: { flex: 1, alignItems: 'center', gap: space.sm },
  statValue: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  countValue: { fontSize: 18, lineHeight: 22, fontWeight: '800' },
  countLabel: { fontSize: 12, lineHeight: 16, color: colors.secondary },
  identity: { gap: space.xs },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  name: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  role: { color: colors.secondary, fontSize: 13 },
  bio: { color: colors.text, fontSize: 14, lineHeight: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tag: {
    color: colors.secondary,
    fontSize: 10,
    lineHeight: 16,
    backgroundColor: colors.raised,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  statusText: {
    color: colors.brand,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  club: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  clubText: { color: colors.secondary, fontSize: 12, lineHeight: 18, flex: 1 },
  claim: { color: colors.muted, fontSize: 11 },
  actions: { flexDirection: 'row', gap: space.sm },
  share: {
    width: 44,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  edit: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  editText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  pressed: { backgroundColor: colors.overlay },
  visibility: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  visibilityText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
});
