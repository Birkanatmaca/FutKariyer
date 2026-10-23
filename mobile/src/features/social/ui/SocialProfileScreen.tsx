import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BadgeCheck, Ellipsis, Eye } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { Avatar } from '../../../shared/ui/Avatar';
import { ProBadge } from '../../../shared/ui/ProBadge';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { avatarUrl, useAvatarSource } from '../../../shared/lib/avatar';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import {
  ModerationSheet,
  moderationService,
  type ModerationTarget,
} from '../../moderation';
import {
  PlayerMediaGallery,
  PlayerProfileContent,
  playerMediaService,
  type ProfileCounts,
  type ProfilePostsSlot,
} from '../../players';
import type { SocialService } from '../application/social-service';
import { useProfilePostMedia } from '../application/useProfilePostMedia';
import type { SocialProfile } from '../domain/models';
import { ProfilePosts } from './ProfilePosts';
import { PostMediaThumb } from './PostMediaThumb';

// Someone's profile, opened from a post's photo or name (22 Oct 2026). It
// uses the own Profil page's Instagram layout: photo with the brand ring,
// counts beside it, name and football tags, buttons, then the Gönderiler,
// Fotoğraflar and Videolar tabs. A player the viewer may discover shows the
// full football card and gallery; others show what their posts already show.
// Opening someone else's profile records a visit in their Ziyaretçiler.
export function SocialProfileScreen({
  token,
  userId,
  service,
  onBack,
  onOpenPost,
  onOpenDiscovery,
  onOwnProfile,
  onFollowList,
  onMessage,
}: {
  token: string;
  userId: string;
  service: SocialService;
  onBack(): void;
  onOpenPost(id: string): void;
  // The discovery profile (introduction request), when discovery rules allow it.
  onOpenDiscovery?(kind: SocialProfile['role'], id: string): void;
  // Tapping your own name opens your own Profil page instead.
  onOwnProfile?(): void;
  // The follower and following counts open the lists (23 Oct 2026).
  onFollowList?(kind: 'followers' | 'following', name: string): void;
  // Opens the conversation when messaging is open between the two (23 Oct 2026).
  onMessage?(id: string): void;
}) {
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [error, setError] = useState('');
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState('');
  const [moderating, setModerating] = useState<ModerationTarget | null>(null);
  const operation = useRef(0);
  const avatarSource = useAvatarSource(
    profile ? avatarUrl(profile.id, profile.avatarVersion) : undefined,
  );
  // A player picks which post photos and videos appear on the profile; clubs
  // and coaches show every post with media.
  const media = useProfilePostMedia(
    service,
    profile ? token : null,
    userId,
    profile?.role === 'player' ? 'media' : 'all',
  );
  const load = useCallback(() => {
    let current = true;
    operation.current += 1;
    setError('');
    service
      .profile(token, userId)
      .then(value => current && setProfile(value))
      .catch(
        failure =>
          current &&
          setError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          ),
      );
    return () => {
      current = false;
    };
  }, [service, token, userId]);
  useFocusEffect(load);
  async function follow() {
    if (!profile || followBusy) return;
    const current = operation.current;
    const next = !profile.following;
    setFollowBusy(true);
    setFollowError('');
    try {
      await service.follow(token, profile.id, next);
      if (operation.current === current)
        setProfile(value =>
          value
            ? {
                ...value,
                following: next,
                followers: Math.max(0, value.followers + (next ? 1 : -1)),
              }
            : value,
        );
    } catch (failure) {
      if (operation.current === current)
        setFollowError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        );
    } finally {
      if (operation.current === current) setFollowBusy(false);
    }
  }
  const posts: ProfilePostsSlot | undefined = profile
    ? {
        postsTab: (
          <ProfilePosts
            token={token}
            userId={profile.id}
            service={service}
            onOpen={onOpenPost}
          />
        ),
        media,
        renderMedia: item => (
          <PostMediaThumb
            id={item.id}
            kind={item.kind}
            token={token}
            service={service}
          />
        ),
        onOpenMedia: onOpenPost,
      }
    : undefined;
  const counts: ProfileCounts | null = profile
    ? {
        views: 0,
        posts: profile.posts,
        followers: profile.followers,
        following: profile.followingCount,
      }
    : null;
  const actions = profile ? (
    <View style={styles.actionsBlock}>
      <View style={styles.actions}>
        {profile.self ? (
          onOwnProfile ? (
            <ActionButton
              label={copy.social.profileOwn}
              onPress={onOwnProfile}
            />
          ) : null
        ) : (
          <>
            <ActionButton
              label={
                profile.following ? copy.social.followed : copy.social.follow
              }
              primary={!profile.following}
              busy={followBusy}
              selected={profile.following}
              onPress={follow}
            />
            {profile.canMessage && onMessage ? (
              <ActionButton
                label={copy.messages.message}
                onPress={() => onMessage(profile.id)}
              />
            ) : null}
            {profile.discovery && onOpenDiscovery ? (
              <ActionButton
                label={copy.social.profileFootball}
                onPress={() => onOpenDiscovery(profile.role, profile.id)}
              />
            ) : null}
          </>
        )}
      </View>
      <ErrorBanner message={followError || null} />
      {!profile.self ? (
        <View style={styles.visit}>
          <Eye size={14} color={colors.muted} />
          <Text style={styles.visitText}>{copy.social.profileVisitNote}</Text>
        </View>
      ) : null}
    </View>
  ) : null;
  return (
    <Screen>
      <TopBar
        title={profile?.fullName ?? copy.social.profileTitle}
        onBack={onBack}
        accessory={
          profile && !profile.self ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.moderation.more(profile.fullName)}
              onPress={() =>
                setModerating({
                  kind: 'user',
                  id: profile.id,
                  userId: profile.id,
                  name: profile.fullName,
                })
              }
              style={styles.more}
            >
              <Ellipsis color={colors.text} size={20} />
            </Pressable>
          ) : null
        }
      />
      {error && !profile ? (
        <>
          <ErrorBanner message={error} />
          <Button label={copy.form.retry} onPress={() => load()} />
        </>
      ) : !profile ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : profile.playerProfile ? (
        <PlayerProfileContent
          fullName={profile.fullName}
          profile={profile.playerProfile}
          avatarSource={avatarSource}
          counts={counts}
          isPro={!!profile.isPro}
          verified={profile.verified}
          posts={posts}
          actions={actions}
          onFollowers={() => onFollowList?.('followers', profile.fullName)}
          onFollowing={() => onFollowList?.('following', profile.fullName)}
          gallery={{
            token,
            ownerId: profile.id,
            service: playerMediaService,
          }}
        />
      ) : (
        <>
          <ProfileHeader
            profile={profile}
            counts={counts}
            actions={actions}
            onFollowers={() => onFollowList?.('followers', profile.fullName)}
            onFollowing={() => onFollowList?.('following', profile.fullName)}
          />
          <PlayerMediaGallery posts={posts} />
        </>
      )}
      <ModerationSheet
        target={moderating}
        token={token}
        service={moderationService}
        onClose={() => {
          const blocked = moderating && !profile;
          setModerating(null);
          if (blocked) onBack();
        }}
        onBlocked={() => setProfile(null)}
      />
    </Screen>
  );
}

// The own profile header's layout for accounts without a football card:
// clubs, coaches and players hidden from discovery.
function ProfileHeader({
  profile,
  counts,
  actions,
  onFollowers,
  onFollowing,
}: {
  profile: SocialProfile;
  counts: ProfileCounts | null;
  actions: React.ReactNode;
  onFollowers(): void;
  onFollowing(): void;
}) {
  const tags = [
    profile.footballType && profile.footballType !== 'unknown'
      ? copy.football.types[profile.footballType]
      : '',
    profile.licenseStatus && profile.licenseStatus !== 'unknown'
      ? copy.playerProfile.licenseDeclaration +
        ': ' +
        copy.football.licenseStatuses[profile.licenseStatus]
      : '',
  ].filter(Boolean);
  const stats = counts
    ? [
        [copy.playerOverview.postCount, counts.posts ?? 0],
        [copy.playerOverview.followers, counts.followers],
        [copy.playerOverview.following, counts.following],
      ]
    : [];
  return (
    <View style={styles.header}>
      <View style={styles.top}>
        <View
          style={[styles.ring, profile.role === 'club' && styles.ringSquare]}
        >
          <Avatar
            name={profile.fullName}
            uri={avatarUrl(profile.id, profile.avatarVersion)}
            size={84}
            square={profile.role === 'club'}
          />
        </View>
        <View style={styles.stats}>
          {stats.map(([label, value], index) => {
            const onPress =
              index === 1 ? onFollowers : index === 2 ? onFollowing : undefined;
            return (
              <Pressable
                key={String(label)}
                disabled={!onPress}
                onPress={onPress}
                style={styles.stat}
                accessible
                accessibilityRole={onPress ? 'button' : undefined}
                accessibilityLabel={value + ' ' + label}
              >
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text accessibilityRole="header" style={styles.name}>
            {profile.fullName}
          </Text>
          {profile.verified ? (
            <BadgeCheck
              accessibilityLabel={copy.social.verified}
              size={17}
              color={colors.accent}
            />
          ) : null}
          {profile.isPro ? <ProBadge /> : null}
        </View>
        <Text style={styles.role}>{copy.roles[profile.role]}</Text>
        {tags.length ? (
          <View style={styles.tags}>
            {tags.map(tag => (
              <Text key={tag} style={styles.tag}>
                {tag}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      {actions}
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  primary = false,
  busy = false,
  selected,
}: {
  label: string;
  onPress(): void;
  primary?: boolean;
  busy?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy, selected }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        primary && styles.actionPrimary,
        pressed && (primary ? styles.primaryPressed : styles.pressed),
      ]}
    >
      {busy ? (
        <ActivityIndicator
          size="small"
          color={primary ? colors.brandInk : colors.text}
        />
      ) : (
        <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loader: { paddingVertical: space.xxl },
  more: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same measures as the own profile header (players/PlayerProfileHeader).
  header: { gap: space.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  ring: {
    padding: 3,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  ringSquare: { borderRadius: radius.md },
  stats: { flex: 1, flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, alignItems: 'center', gap: space.sm },
  statValue: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  statLabel: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  identity: { gap: space.xs },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  name: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  role: { color: colors.secondary, fontSize: 13 },
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
  actionsBlock: { gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  action: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  actionPrimary: { backgroundColor: colors.brand, borderColor: colors.brand },
  actionText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  actionTextPrimary: { color: colors.brandInk, fontWeight: '700' },
  pressed: { backgroundColor: colors.overlay },
  primaryPressed: { opacity: 0.85 },
  visit: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  visitText: { color: colors.muted, fontSize: 11, lineHeight: 16, flex: 1 },
});
