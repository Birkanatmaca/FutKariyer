import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BadgeCheck, Ellipsis, Eye, Images } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { Avatar } from '../../../shared/ui/Avatar';
import { ProBadge } from '../../../shared/ui/ProBadge';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { avatarUrl } from '../../../shared/lib/avatar';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import {
  ModerationSheet,
  moderationService,
  type ModerationTarget,
} from '../../moderation';
import type { SocialService } from '../application/social-service';
import { useSocialList } from '../application/useSocialList';
import type { SocialProfile } from '../domain/models';
import { ProfilePosts } from './ProfilePosts';
import { PostMediaThumb } from './PostMediaThumb';

type Tab = 'posts' | 'media';

// An author's profile, opened from a post's name or photo (22 Oct 2026):
// photo, name, badges, counts, follow, posts and their photos and videos.
// Opening someone else's profile records a visit in their Ziyaretçiler.
export function SocialProfileScreen({
  token,
  userId,
  service,
  onBack,
  onOpenPost,
  onOpenDiscovery,
  onOwnProfile,
}: {
  token: string;
  userId: string;
  service: SocialService;
  onBack(): void;
  onOpenPost(id: string): void;
  // The fuller football profile, when discovery rules allow it.
  onOpenDiscovery?(kind: SocialProfile['role'], id: string): void;
  // Tapping your own name opens your own Profil page instead.
  onOwnProfile?(): void;
}) {
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('posts');
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState('');
  const [moderating, setModerating] = useState<ModerationTarget | null>(null);
  const operation = useRef(0);
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
  const facts = profile
    ? [
        copy.roles[profile.role],
        profile.footballType && profile.footballType !== 'unknown'
          ? copy.football.types[profile.footballType]
          : '',
        profile.licenseStatus === 'licensed'
          ? copy.social.profileLicensed
          : profile.licenseStatus === 'unlicensed'
          ? copy.social.profileUnlicensed
          : '',
      ].filter(Boolean)
    : [];
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
      ) : (
        <>
          <View style={styles.card}>
            <View
              style={[
                styles.ring,
                profile.role === 'club' && styles.ringSquare,
              ]}
            >
              <Avatar
                name={profile.fullName}
                uri={avatarUrl(profile.id, profile.avatarVersion)}
                size={88}
                square={profile.role === 'club'}
              />
            </View>
            <View style={styles.nameRow}>
              <Text style={styles.name} accessibilityRole="header">
                {profile.fullName}
              </Text>
              {profile.verified ? (
                <BadgeCheck
                  accessibilityLabel={copy.social.verified}
                  size={18}
                  color={colors.accent}
                />
              ) : null}
              {profile.isPro ? <ProBadge /> : null}
            </View>
            <Text style={styles.facts}>{facts.join(' · ')}</Text>
            <View style={styles.counts}>
              {[
                [copy.social.profilePosts, profile.posts],
                [copy.social.profileFollowers, profile.followers],
                [copy.social.profileFollowing, profile.followingCount],
              ].map(([label, value]) => (
                <View key={String(label)} style={styles.count}>
                  <Text style={styles.countValue}>{value}</Text>
                  <Text style={styles.countLabel}>{label}</Text>
                </View>
              ))}
            </View>
            {profile.self ? (
              onOwnProfile ? (
                <Button
                  label={copy.social.profileOwn}
                  secondary
                  onPress={onOwnProfile}
                />
              ) : null
            ) : (
              <View style={styles.actions}>
                <View style={styles.action}>
                  <Button
                    label={
                      profile.following
                        ? copy.social.followed
                        : copy.social.follow
                    }
                    secondary={profile.following}
                    loading={followBusy}
                    onPress={follow}
                  />
                </View>
                {profile.discovery && onOpenDiscovery ? (
                  <View style={styles.action}>
                    <Button
                      label={copy.social.profileFootball}
                      secondary
                      onPress={() => onOpenDiscovery(profile.role, profile.id)}
                    />
                  </View>
                ) : null}
              </View>
            )}
            <ErrorBanner message={followError || null} />
            {!profile.self ? (
              <View style={styles.visit}>
                <Eye size={14} color={colors.muted} />
                <Text style={styles.visitText}>
                  {copy.social.profileVisitNote}
                </Text>
              </View>
            ) : null}
          </View>
          <View accessibilityRole="tablist" style={styles.tabs}>
            {(
              [
                ['posts', copy.social.profilePostsTab],
                ['media', copy.social.profileMediaTab],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === key }}
                onPress={() => setTab(key)}
                style={[styles.tab, tab === key && styles.tabOn]}
              >
                <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {tab === 'posts' ? (
            <ProfilePosts
              token={token}
              userId={profile.id}
              service={service}
              onOpen={onOpenPost}
              flush
            />
          ) : (
            <MediaGrid
              token={token}
              userId={profile.id}
              // A player picks which photos and videos appear on the profile;
              // clubs and coaches show every post with media.
              profileOnly={profile.role === 'player'}
              service={service}
              onOpen={onOpenPost}
            />
          )}
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

function MediaGrid({
  token,
  userId,
  profileOnly,
  service,
  onOpen,
}: {
  token: string;
  userId: string;
  profileOnly: boolean;
  service: SocialService;
  onOpen(id: string): void;
}) {
  const list = useSocialList(
    useCallback(
      (cursor: string) =>
        service.userPosts(token, userId, cursor, profileOnly ? 'media' : 'all'),
      [service, token, userId, profileOnly],
    ),
  );
  const items = list.items.filter(post => post.media);
  if (list.loading)
    return <ActivityIndicator color={colors.brand} style={styles.loader} />;
  if (list.error && !items.length)
    return (
      <>
        <ErrorBanner message={list.error} />
        <Button label={copy.form.retry} secondary onPress={list.refresh} />
      </>
    );
  return (
    <View style={styles.gridRoot}>
      {items.length ? (
        <View style={styles.grid}>
          {items.map(post => (
            <Pressable
              key={post.id}
              accessibilityRole="button"
              accessibilityLabel={
                post.media?.kind === 'video'
                  ? copy.social.profileOpenVideo
                  : copy.social.profileOpenPhoto
              }
              onPress={() => onOpen(post.id)}
              style={styles.cell}
            >
              <PostMediaThumb
                id={post.id}
                kind={post.media!.kind}
                token={token}
                service={service}
              />
            </Pressable>
          ))}
        </View>
      ) : !list.hasMore ? (
        <View style={styles.empty}>
          <Images size={28} color={colors.secondary} />
          <Text style={styles.emptyText}>{copy.social.profileMediaEmpty}</Text>
        </View>
      ) : null}
      {list.hasMore ? (
        <Button
          label={copy.social.profileMore}
          secondary
          loading={list.loadingMore}
          onPress={list.loadMore}
        />
      ) : null}
    </View>
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
  card: {
    alignItems: 'center',
    gap: space.md,
    padding: space.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ring: {
    padding: 3,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  ringSquare: { borderRadius: radius.lg },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.xs,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  facts: { color: colors.secondary, fontSize: 13, textAlign: 'center' },
  counts: { flexDirection: 'row', alignSelf: 'stretch' },
  count: { flex: 1, alignItems: 'center', gap: 2 },
  countValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  countLabel: { color: colors.muted, fontSize: 12 },
  actions: { gap: space.sm, alignSelf: 'stretch' },
  action: { alignSelf: 'stretch' },
  visit: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  visitText: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  tabs: {
    flexDirection: 'row',
    padding: space.xs,
    gap: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.transparent,
  },
  tabOn: { backgroundColor: colors.overlay, borderColor: colors.brandSoft },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  tabTextOn: { color: colors.text },
  gridRoot: { gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  cell: {
    width: '32.5%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  emptyText: { color: colors.secondary, fontSize: 13, textAlign: 'center' },
});
