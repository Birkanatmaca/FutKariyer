import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, Newspaper } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, space } from '../../../styles/tokens';
import type { ContentService } from '../application/content-service';
import { NewsCard } from './NewsCard';
export function NewsScreen({
  service,
  token,
  onOpen,
  onBack,
}: {
  service: ContentService;
  token: string | null;
  onOpen(id: string): void;
  onBack?(): void;
}) {
  const [page, setPage] = useState(1);
  const state = useFocusedResource(
    useCallback(
      () =>
        token
          ? service.news(token, page)
          : Promise.reject(new Error(copy.playerProfile.sessionError)),
      [service, token, page],
    ),
  );
  useEffect(() => {
    if (
      !state.loading &&
      state.data &&
      page > Math.max(1, state.data.totalPages)
    ) {
      setPage(Math.max(1, state.data.totalPages));
    }
  }, [page, state.data, state.loading]);
  return (
    <Screen>
      {onBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.form.back}
          onPress={onBack}
          style={styles.back}
        >
          <ArrowLeft size={20} color={colors.text} />
          <Text style={styles.backText}>{copy.form.back}</Text>
        </Pressable>
      )}
      <PageHeader
        eyebrow={copy.news.eyebrow}
        title={copy.news.title}
        hint={copy.news.description}
      />
      {state.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} onPress={state.retry} />
        </>
      ) : (
        state.data && (
          <>
            <Button label={copy.news.refresh} secondary onPress={state.retry} />
            {state.data.items.length ? (
              state.data.items.map(article => (
                <NewsCard
                  key={article.id}
                  article={article}
                  imageUrl={service.imageUrl}
                  onPress={() => onOpen(article.id)}
                />
              ))
            ) : (
              <EmptyState
                icon={Newspaper}
                title={copy.news.emptyTitle}
                body={copy.news.emptyBody}
              />
            )}
            {(state.data.totalPages > 1 || page > 1) && (
              <View style={styles.pages}>
                <Button
                  label={copy.discover.previous}
                  secondary
                  disabled={page <= 1}
                  onPress={() => setPage(v => v - 1)}
                />
                <Text style={styles.page}>
                  {copy.discover.page(page, state.data.totalPages)}
                </Text>
                <Button
                  label={copy.discover.next}
                  secondary
                  disabled={page >= state.data.totalPages}
                  onPress={() => setPage(v => v + 1)}
                />
              </View>
            )}
          </>
        )
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  back: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
  },
  backText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  pages: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  page: { color: colors.muted, fontSize: 12 },
});
