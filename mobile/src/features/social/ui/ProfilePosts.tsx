import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Newspaper } from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { SocialService } from '../application/social-service';
import { useSocialList } from '../application/useSocialList';
import { SocialPostCard } from './SocialPostCard';
import { DeleteContentPrompt } from './DeleteContentPrompt';

// A profile's Gönderiler tab: the author's posts exactly as the feed shows
// them (text, photo or video), newest first.
export function ProfilePosts({
  token,
  userId,
  service,
  onOpen,
  onCompose,
}: {
  token: string;
  userId: string;
  service: SocialService;
  onOpen(id: string): void;
  // Own profile: start a new post from here.
  onCompose?(): void;
}) {
  const posts = useSocialList(
    useCallback(
      (cursor: string) => service.userPosts(token, userId, cursor),
      [service, token, userId],
    ),
  );
  const [busy, setBusy] = useState('');
  const [deleting, setDeleting] = useState('');
  const [error, setError] = useState('');
  async function like(id: string, liked: boolean) {
    if (busy) return;
    setBusy(id);
    setError('');
    try {
      posts.replace(await service.like(token, id, !liked));
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
      posts.remove(deleting);
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
    <View style={styles.root}>
      {onCompose ? (
        <Button label={copy.social.profileCompose} onPress={onCompose} />
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      {posts.loading ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : posts.error && !posts.items.length ? (
        <>
          <ErrorBanner message={posts.error} />
          <Button label={copy.form.retry} secondary onPress={posts.refresh} />
        </>
      ) : posts.items.length ? (
        <>
          {posts.items.map(item => (
            <SocialPostCard
              key={item.id}
              item={item}
              framed
              busy={busy === item.id}
              token={token}
              service={service}
              onLike={() => like(item.id, item.liked)}
              onReplies={() => onOpen(item.id)}
              onDelete={() => setDeleting(item.id)}
            />
          ))}
          {posts.hasMore ? (
            <Button
              label={copy.social.profileMore}
              secondary
              loading={posts.loadingMore}
              onPress={posts.loadMore}
            />
          ) : null}
        </>
      ) : (
        <View accessibilityLiveRegion="polite" style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Newspaper size={29} color={colors.secondary} />
          </View>
          <Text style={styles.emptyTitle}>{copy.social.profileEmpty}</Text>
          <Text style={styles.emptyBody}>
            {onCompose
              ? copy.social.profileEmptyOwn
              : copy.social.profileEmptyOther}
          </Text>
        </View>
      )}
      <DeleteContentPrompt
        visible={!!deleting}
        busy={!!busy}
        onCancel={() => setDeleting('')}
        onConfirm={remove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md, paddingHorizontal: space.xl, paddingTop: space.md },
  loader: { paddingVertical: space.xxl },
  empty: {
    paddingHorizontal: space.xl,
    paddingVertical: space.xxxl,
    alignItems: 'center',
    gap: space.md,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  emptyBody: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
