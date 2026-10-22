import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, MessageCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '../../../shared/lib/copy';
import { colors, space } from '../../../styles/tokens';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useSocialPost } from '../application/useSocialPost';
import { useSocialList } from '../application/useSocialList';
import type { SocialService } from '../application/social-service';
import { PostComposer } from './PostComposer';
import { SocialPostCard } from './SocialPostCard';
import { DeleteContentPrompt } from './DeleteContentPrompt';
import {
  ModerationSheet,
  moderationService,
  type ModerationTarget,
} from '../../moderation';

export function SocialThreadScreen({
  token,
  name,
  id,
  service,
  onBack,
  onOpenProfile,
}: {
  token: string;
  name: string;
  id: string;
  service: SocialService;
  onBack(): void;
  // The post's or a reply's author photo or name opens their profile.
  onOpenProfile?(userId: string): void;
}) {
  const post = useSocialPost(service, token, id);
  const replies = useSocialList(
    useCallback(
      (cursor: string) => service.replies(token, id, cursor),
      [service, token, id],
    ),
  );
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    reply: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  const [moderating, setModerating] = useState<ModerationTarget | null>(null);
  async function send(body: string) {
    setSending(true);
    setError('');
    try {
      replies.prepend(await service.createReply(token, id, body));
      post.update(
        value => value && { ...value, replyCount: value.replyCount + 1 },
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
      throw failure;
    } finally {
      setSending(false);
    }
  }
  async function like() {
    if (busy || !post.data) return;
    setBusy(true);
    setError('');
    try {
      post.update(await service.like(token, id, !post.data.liked));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    setError('');
    try {
      if (deleteTarget.reply) {
        await service.deleteReply(token, id, deleteTarget.id);
        replies.remove(deleteTarget.id);
        post.update(
          value =>
            value && {
              ...value,
              replyCount: Math.max(0, value.replyCount - 1),
            },
        );
      } else {
        await service.deletePost(token, id);
        onBack();
      }
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  }
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <FlatList
        data={post.data ? replies.items : []}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.social.back}
              onPress={onBack}
              style={styles.back}
            >
              <ArrowLeft size={20} color={colors.text} />
              <Text style={styles.backText}>{copy.social.back}</Text>
            </Pressable>
            <Text style={styles.title}>{copy.social.threadTitle}</Text>
            {error || post.error || replies.error ? (
              <ErrorBanner
                message={error || post.error || replies.error || ''}
              />
            ) : null}
            {post.loading ? (
              <ActivityIndicator color={colors.brand} />
            ) : post.error ? (
              <Button label={copy.form.retry} onPress={post.retry} />
            ) : post.data ? (
              <>
                <SocialPostCard
                  item={post.data}
                  token={token}
                  service={service}
                  busy={busy || sending}
                  onLike={() => like()}
                  onAuthor={
                    onOpenProfile && post.data
                      ? () => post.data && onOpenProfile(post.data.author.id)
                      : undefined
                  }
                  onDelete={() => setDeleteTarget({ id, reply: false })}
                  onMore={() =>
                    post.data &&
                    setModerating({
                      kind: 'post',
                      id,
                      userId: post.data.author.id,
                      name: post.data.author.fullName,
                    })
                  }
                />
                <PostComposer
                  name={name}
                  reply
                  busy={
                    sending ||
                    busy ||
                    replies.loading ||
                    replies.refreshing ||
                    replies.loadingMore
                  }
                  onSubmit={send}
                />
                <Text style={styles.replyTitle}>{copy.social.replies}</Text>
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <SocialPostCard
            item={item}
            token={token}
            service={service}
            busy={busy || sending}
            onDelete={() => setDeleteTarget({ id: item.id, reply: true })}
            onAuthor={
              onOpenProfile ? () => onOpenProfile(item.author.id) : undefined
            }
            onMore={() =>
              setModerating({
                kind: 'reply',
                id: item.id,
                userId: item.author.id,
                name: item.author.fullName,
              })
            }
          />
        )}
        ListEmptyComponent={
          post.data ? (
            replies.loading ? (
              <ActivityIndicator color={colors.brand} />
            ) : replies.error ? (
              <Button
                label={copy.form.retry}
                secondary
                onPress={() => replies.refresh()}
              />
            ) : (
              <EmptyState
                icon={MessageCircle}
                title={copy.social.noReplies}
                body={copy.social.firstReply}
              />
            )
          ) : null
        }
        ListFooterComponent={
          post.data && replies.hasMore ? (
            <View style={styles.more}>
              <Button
                label={copy.social.loadMoreReplies}
                secondary
                loading={replies.loadingMore}
                disabled={busy || sending || replies.refreshing}
                onPress={replies.loadMore}
              />
            </View>
          ) : null
        }
      />
      <DeleteContentPrompt
        visible={!!deleteTarget}
        busy={busy}
        reply={deleteTarget?.reply}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => remove()}
      />
      <ModerationSheet
        target={moderating}
        token={token}
        service={moderationService}
        onClose={() => setModerating(null)}
        onBlocked={userId => {
          // Blocking the post's author closes the thread; a reply author only drops out.
          if (userId === post.data?.author.id) onBack();
          else replies.refresh();
        }}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: space.xl,
    paddingBottom: 150,
    flexGrow: 1,
  },
  header: { gap: space.lg },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  backText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  title: { color: colors.text, fontSize: 25, fontWeight: '800' },
  replyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    paddingTop: space.sm,
  },
  more: { paddingTop: space.xl },
});
