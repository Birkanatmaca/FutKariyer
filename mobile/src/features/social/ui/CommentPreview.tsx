import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { SocialService } from '../application/social-service';
import type { SocialReply } from '../domain/models';

// First comment of each post, fetched once per post and reply count so the
// feed does not repeat the request while scrolling.
const cache = new Map<string, SocialReply | null>();

export function CommentPreview({
  token,
  service,
  postId,
  replyCount,
  onPress,
}: {
  token: string;
  service: SocialService;
  postId: string;
  replyCount: number;
  onPress?(): void;
}) {
  const key = postId + ':' + replyCount;
  const [reply, setReply] = useState<SocialReply | null | undefined>(
    replyCount > 0 ? cache.get(key) : null,
  );
  useEffect(() => {
    if (replyCount <= 0) {
      setReply(null);
      return;
    }
    if (cache.has(key)) {
      setReply(cache.get(key));
      return;
    }
    let current = true;
    service
      .replies(token, postId)
      .then(page => {
        const value = page.items[0] ?? null;
        cache.set(key, value);
        if (current) setReply(value);
      })
      .catch(() => {
        if (current) setReply(null);
      });
    return () => {
      current = false;
    };
  }, [service, token, postId, replyCount, key]);
  if (!reply) return null;
  const initial = Array.from(reply.author.fullName.trim())[0] ?? '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={reply.author.fullName + ': ' + reply.body}
      accessibilityHint={copy.social.replyLabel(replyCount)}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.box, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        <Text style={styles.initial}>{initial.toLocaleUpperCase('tr-TR')}</Text>
      </View>
      <Text numberOfLines={2} style={styles.text}>
        <Text style={styles.name}>{reply.author.fullName} </Text>
        {reply.body}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  pressed: { opacity: 0.8 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  initial: { color: colors.text, fontSize: 11, fontWeight: '800' },
  text: {
    flex: 1,
    ...type.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.secondary,
  },
  name: { color: colors.text, fontWeight: '700' },
});
