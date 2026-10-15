import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, space } from '../../../styles/tokens';
import type { Article } from '../domain/models';
import { NewsCard } from './NewsCard';
export function HomeNews({
  items,
  imageUrl,
  onNews,
}: {
  items: Article[];
  imageUrl(id: string): string;
  onNews(): void;
}) {
  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.news.all}
        style={styles.heading}
        onPress={onNews}
      >
        <Text accessibilityRole="header" style={styles.title}>
          {copy.news.title}
        </Text>
        <View style={styles.link}>
          <Text style={styles.linkText}>{copy.news.all}</Text>
          <ChevronRight size={16} color={colors.brand} />
        </View>
      </Pressable>
      {items.length ? (
        items.map(article => (
          <NewsCard
            key={article.id}
            article={article}
            imageUrl={imageUrl}
            onPress={onNews}
          />
        ))
      ) : (
        <Text style={styles.empty}>{copy.news.noHome}</Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: space.md },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: '700' },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  linkText: { color: colors.brand, fontSize: 12, fontWeight: '600' },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 21 },
});
