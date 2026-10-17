import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BadgeCheck,
  Ellipsis,
  MessageCircle,
  Trash2,
} from 'lucide-react-native';
import { ProBadge } from '../../../shared/ui/ProBadge';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import { PostMedia } from './PostMedia';
import { LikeButton } from './LikeButton';
import { CommentPreview } from './CommentPreview';
import type { SocialService } from '../application/social-service';
import type { SocialPost, SocialReply } from '../domain/models';

export function SocialPostCard({
  item,
  busy,
  onLike,
  onReplies,
  onDelete,
  onFollow,
  onMore,
  token,
  service,
  framed,
}: {
  item: SocialPost | SocialReply;
  busy?: boolean;
  onLike?(): void;
  onReplies?(): void;
  onDelete(): void;
  onFollow?(): void;
  // Report or block someone else's post or reply.
  onMore?(): void;
  token: string;
  service: SocialService;
  // Feed cards: rounded surface card with a one-comment preview.
  framed?: boolean;
}) {
  const post = 'likeCount' in item ? item : null;
  const [first, second] = item.author.fullName.trim().split(/\s+/);
  const initials = [first, second]
    .filter(Boolean)
    .map(value => Array.from(value)[0])
    .join('')
    .toLocaleUpperCase('tr-TR');
  return (
    <View style={[styles.card, framed && styles.framed]}>
      <View style={styles.row}>
        <View
          style={[
            styles.avatar,
            item.author.role === 'club' && styles.clubAvatar,
          ]}
        >
          <Text style={styles.initials}>{initials}</Text>
        </View>
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.author.fullName}</Text>
            {item.author.verified && (
              <BadgeCheck
                accessibilityLabel={copy.social.verified}
                size={16}
                color={colors.accent}
              />
            )}
            {item.author.isPro ? <ProBadge /> : null}
          </View>
          <Text style={styles.meta}>
            {copy.roles[item.author.role]} · {copy.social.date(item.createdAt)}
          </Text>
          {item.author.footballType &&
          item.author.footballType !== 'unknown' ? (
            <Text style={styles.authorType}>
              {copy.football.types[item.author.footballType]}
              {item.author.licenseStatus &&
              item.author.licenseStatus !== 'unknown'
                ? ' · ' +
                  copy.playerProfile.licenseDeclaration +
                  ': ' +
                  copy.football.licenseStatuses[item.author.licenseStatus]
                : ''}
            </Text>
          ) : null}
        </View>
        {!item.owned && onFollow ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              item.author.following ? copy.social.unfollow : copy.social.follow
            }
            disabled={busy}
            accessibilityState={{
              selected: item.author.following,
              disabled: !!busy,
            }}
            aria-pressed={item.author.following}
            onPress={onFollow}
            style={styles.follow}
          >
            <Text
              style={[
                styles.followText,
                item.author.following && styles.followed,
              ]}
            >
              {item.author.following
                ? copy.social.followed
                : copy.social.follow}
            </Text>
          </Pressable>
        ) : null}
        {!item.owned && onMore ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.moderation.more(item.author.fullName)}
            disabled={busy}
            onPress={onMore}
            hitSlop={8}
            style={styles.delete}
          >
            <Ellipsis size={18} color={colors.muted} />
          </Pressable>
        ) : null}
        {item.owned && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              post ? copy.social.deletePost : copy.social.deleteReply
            }
            disabled={busy}
            onPress={onDelete}
            style={styles.delete}
          >
            <Trash2 size={17} color={colors.muted} />
          </Pressable>
        )}
      </View>
      {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
      {post?.media ? (
        <PostMedia
          media={post.media}
          id={post.id}
          token={token}
          service={service}
        />
      ) : null}
      {post && (
        <View style={styles.actions}>
          <LikeButton
            liked={post.liked}
            count={post.likeCount}
            disabled={busy}
            onPress={onLike}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.social.replyLabel(post.replyCount)}
            onPress={onReplies}
            disabled={!onReplies}
            style={styles.action}
          >
            <MessageCircle size={19} color={colors.muted} />
            <Text style={styles.actionText}>{post.replyCount}</Text>
          </Pressable>
          <Text style={styles.public}>{copy.social.publicPost}</Text>
          {busy && <ActivityIndicator size="small" color={colors.brand} />}
        </View>
      )}
      {framed && post ? (
        <CommentPreview
          token={token}
          service={service}
          postId={post.id}
          replyCount={post.replyCount}
          onPress={onReplies}
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  framed: {
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  card: {
    paddingVertical: space.lg,
    gap: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubAvatar: { borderRadius: radius.sm },
  initials: { color: colors.text, fontSize: 14, fontWeight: '800' },
  identity: { flex: 1, gap: space.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  name: { color: colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  authorType: { color: colors.secondary, fontSize: 10, lineHeight: 15 },
  delete: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  follow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  followText: { color: colors.brand, fontSize: 11, fontWeight: '700' },
  followed: { color: colors.muted },
  body: { color: colors.text, fontSize: 15, lineHeight: 23 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  action: {
    minHeight: 44,
    minWidth: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  actionText: { color: colors.muted, fontSize: 12 },
  liked: { color: colors.danger },
  public: { flex: 1, color: colors.muted, fontSize: 10, textAlign: 'right' },
});
