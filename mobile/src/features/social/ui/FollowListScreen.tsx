import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BadgeCheck, Users } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { Avatar } from '../../../shared/ui/Avatar';
import { ProBadge } from '../../../shared/ui/ProBadge';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { avatarUrl } from '../../../shared/lib/avatar';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { SocialService } from '../application/social-service';
import { useSocialList } from '../application/useSocialList';
import type { FollowListKind } from '../domain/models';

// Someone's followers or followed accounts (23 Oct 2026), like Instagram:
// a row opens that profile, the button follows or unfollows from the list.
export function FollowListScreen({
  token,
  userId,
  viewerId,
  name,
  kind,
  service,
  onBack,
  onOpen,
}: {
  token: string;
  userId: string;
  viewerId: string;
  name: string;
  kind: FollowListKind;
  service: SocialService;
  onBack(): void;
  onOpen(id: string): void;
}) {
  const text = copy.social;
  const list = useSocialList(
    useCallback(
      (cursor: string) => service.follows(token, userId, kind, cursor),
      [service, token, userId, kind],
    ),
  );
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function toggle(id: string, following: boolean) {
    if (busy) return;
    setBusy(id);
    setError('');
    try {
      await service.follow(token, id, !following);
      list.update(item =>
        item.id === id ? { ...item, following: !following } : item,
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy('');
    }
  }
  return (
    <Screen>
      <TopBar
        title={kind === 'followers' ? text.followersTitle : text.followingTitle}
        onBack={onBack}
      />
      <Text style={styles.owner}>{name}</Text>
      <ErrorBanner message={error || null} />
      {list.loading ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : list.error && !list.items.length ? (
        <>
          <ErrorBanner message={list.error} />
          <Button label={copy.form.retry} secondary onPress={list.refresh} />
        </>
      ) : list.items.length ? (
        <View style={styles.list}>
          {list.items.map(item => (
            <View key={item.id} style={styles.row}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={text.openProfile(item.fullName)}
                onPress={() => onOpen(item.id)}
                style={styles.person}
              >
                <Avatar
                  name={item.fullName}
                  uri={avatarUrl(item.id, item.avatarVersion)}
                  size={46}
                  square={item.role === 'club'}
                />
                <View style={styles.identity}>
                  <View style={styles.nameRow}>
                    <Text numberOfLines={1} style={styles.name}>
                      {item.fullName}
                    </Text>
                    {item.verified ? (
                      <BadgeCheck
                        accessibilityLabel={text.verified}
                        size={15}
                        color={colors.accent}
                      />
                    ) : null}
                    {item.isPro ? <ProBadge /> : null}
                  </View>
                  <Text style={styles.meta}>
                    {copy.roles[item.role]}
                    {item.footballType && item.footballType !== 'unknown'
                      ? ' · ' + copy.football.types[item.footballType]
                      : ''}
                  </Text>
                </View>
              </Pressable>
              {item.id !== viewerId ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: item.following,
                    busy: busy === item.id,
                  }}
                  disabled={!!busy}
                  onPress={() => toggle(item.id, item.following)}
                  style={[styles.follow, !item.following && styles.followOn]}
                >
                  {busy === item.id ? (
                    <ActivityIndicator
                      size="small"
                      color={item.following ? colors.text : colors.brandInk}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.followText,
                        !item.following && styles.followTextOn,
                      ]}
                    >
                      {item.following ? text.followed : text.follow}
                    </Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          ))}
          {list.hasMore ? (
            <Button
              label={text.profileMore}
              secondary
              loading={list.loadingMore}
              onPress={list.loadMore}
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.empty}>
          <Users size={28} color={colors.secondary} />
          <Text style={styles.emptyText}>
            {kind === 'followers' ? text.followersEmpty : text.followingEmpty}
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  owner: { color: colors.secondary, fontSize: 13 },
  loader: { paddingVertical: space.xxl },
  list: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  person: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  identity: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  meta: { color: colors.muted, fontSize: 12 },
  follow: {
    minWidth: 104,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  followText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  followTextOn: { color: colors.brandInk, fontWeight: '700' },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  emptyText: { color: colors.secondary, fontSize: 13, textAlign: 'center' },
});
