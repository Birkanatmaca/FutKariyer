import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Plus, Users } from 'lucide-react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { FeedScope } from '../domain/models';
import type { SocialService } from '../application/social-service';
import { useSocialList } from '../application/useSocialList';
import { SocialPostCard } from './SocialPostCard';
import { DeleteContentPrompt } from './DeleteContentPrompt';
import { GamesScreen } from '../../games';
import {
  ModerationSheet,
  moderationService,
  type ModerationTarget,
} from '../../moderation';

export function SocialFeedScreen({
  token,
  service,
  publishedAt,
  onOpen,
  onCompose,
}: {
  token: string;
  service: SocialService;
  publishedAt?: number;
  onOpen(id: string): void;
  onCompose(): void;
}) {
  const [scope, setScope] = useState<FeedScope | 'games'>('explore');
  const insets = useSafeAreaInsets();
  const feed = useSocialList(
    useCallback(
      (cursor: string) =>
        service.feed(token, cursor, scope === 'games' ? 'explore' : scope),
      [service, token, scope],
    ),
    scope !== 'games',
  );
  const [busy, setBusy] = useState('');
  const [deleting, setDeleting] = useState('');
  const [moderating, setModerating] = useState<ModerationTarget | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (publishedAt) {
      setScope('explore');
      setNotice(copy.social.published);
    }
  }, [publishedAt]);
  async function like(id: string, liked: boolean) {
    if (busy) return;
    setBusy(id);
    setError('');
    try {
      feed.replace(await service.like(token, id, !liked));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy('');
    }
  }
  async function follow(id: string, following: boolean) {
    if (busy) return;
    setBusy(id);
    setError('');
    try {
      const value = await service.follow(token, id, !following);
      feed.update(item =>
        item.author.id === id
          ? { ...item, author: { ...item.author, following: value } }
          : item,
      );
      if (scope === 'following' && !value) await feed.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy('');
    }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(deleting);
    setError('');
    try {
      await service.deletePost(token, deleting);
      feed.remove(deleting);
      setNotice(copy.social.deleted);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy('');
      setDeleting('');
    }
  }
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <View style={styles.tabs}>
        {(['explore', 'following', 'games'] as const).map(value => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: scope === value, disabled: !!busy }}
            aria-selected={scope === value}
            disabled={!!busy}
            onPress={() => {
              setScope(value);
              setError('');
              setNotice('');
            }}
            style={styles.tab}
          >
            <Text
              style={[styles.tabText, scope === value && styles.selectedText]}
            >
              {value === 'explore'
                ? copy.social.explore
                : value === 'following'
                ? copy.social.following
                : copy.social.games}
            </Text>
            <View
              style={[
                styles.indicator,
                scope === value && styles.selectedIndicator,
              ]}
            />
          </Pressable>
        ))}
      </View>
      {scope === 'games' ? (
        <GamesScreen token={token} />
      ) : (
        <FlatList
          key={scope}
          data={feed.items}
          keyExtractor={item => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={feed.refreshing && !feed.loading}
              onRefresh={() => {
                if (!busy) feed.refresh();
              }}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
          ListHeaderComponent={
            <View style={styles.messages}>
              {notice ? (
                <Text accessibilityRole="alert" style={styles.notice}>
                  {notice}
                </Text>
              ) : null}
              {error || feed.error ? (
                <ErrorBanner message={error || feed.error} />
              ) : null}
              {feed.error ? (
                <Button
                  label={copy.form.retry}
                  secondary
                  onPress={() => feed.refresh()}
                />
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <SocialPostCard
              item={item}
              token={token}
              service={service}
              busy={!!busy}
              onLike={() => like(item.id, item.liked)}
              onReplies={() => onOpen(item.id)}
              onFollow={() => follow(item.author.id, item.author.following)}
              onDelete={() => setDeleting(item.id)}
              onMore={() =>
                setModerating({
                  kind: 'post',
                  id: item.id,
                  userId: item.author.id,
                  name: item.author.fullName,
                })
              }
            />
          )}
          ListEmptyComponent={
            feed.loading ? (
              <ActivityIndicator color={colors.brand} style={styles.loader} />
            ) : !feed.error ? (
              <View>
                <EmptyState
                  icon={Users}
                  title={
                    scope === 'following'
                      ? copy.social.followingEmptyTitle
                      : copy.social.emptyTitle
                  }
                  body={
                    scope === 'following'
                      ? copy.social.followingEmptyBody
                      : copy.social.emptyBody
                  }
                />
                {scope === 'following' ? (
                  <Button
                    label={copy.social.goExplore}
                    secondary
                    onPress={() => setScope('explore')}
                  />
                ) : null}
              </View>
            ) : null
          }
          ListFooterComponent={
            feed.hasMore && !feed.loading ? (
              <View style={styles.more}>
                <Button
                  label={copy.social.loadMore}
                  secondary
                  loading={feed.loadingMore}
                  disabled={!!busy || feed.refreshing}
                  onPress={feed.loadMore}
                />
              </View>
            ) : null
          }
        />
      )}
      {scope !== 'games' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.social.compose}
          onPress={onCompose}
          style={[
            styles.fab,
            { bottom: 116 + Math.max(insets.bottom, space.md) },
          ]}
        >
          <Plus size={30} strokeWidth={2.5} color={colors.brandInk} />
        </Pressable>
      ) : null}
      <DeleteContentPrompt
        visible={!!deleting}
        busy={!!busy}
        onCancel={() => setDeleting('')}
        onConfirm={() => remove()}
      />
      <ModerationSheet
        target={moderating}
        token={token}
        service={moderationService}
        onClose={() => setModerating(null)}
        onBlocked={() => feed.refresh()}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  tabs: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: space.lg,
  },
  tab: {
    flex: 1,
    minHeight: 62,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: space.sm,
    gap: space.md,
  },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  selectedText: { color: colors.text },
  indicator: {
    width: 48,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.transparent,
  },
  selectedIndicator: { backgroundColor: colors.brand },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: 210,
    flexGrow: 1,
  },
  messages: { gap: space.md },
  notice: { color: colors.success, fontSize: 12, paddingTop: space.lg },
  loader: { padding: space.xl },
  more: { paddingTop: space.xl },
  fab: {
    position: 'absolute',
    right: space.xl,
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.bg,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
});
