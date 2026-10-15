import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../../../styles/tokens';
import { copy } from '../../../shared/lib/copy';
import type { Article } from '../domain/models';
import { ContentImage } from './ContentImage';
export function NewsCard({
  article,
  imageUrl,
  onPress,
}: {
  article: Article;
  imageUrl(id: string): string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={article.title}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {!!article.imageId && (
        <ContentImage uri={imageUrl(article.imageId)} label={article.title} />
      )}
      <View style={styles.body}>
        <Text style={styles.date}>{copy.news.date(article.createdAt)}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {article.title}
        </Text>
        <Text style={styles.summary} numberOfLines={3}>
          {article.summary}
        </Text>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.8 },
  body: { padding: space.lg, gap: space.sm },
  date: { color: colors.muted, fontSize: 10 },
  title: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
  },
  summary: { color: colors.secondary, fontSize: 13, lineHeight: 20 },
});
