import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, space, type } from '../../../styles/tokens';
import type { ContentService } from '../application/content-service';
import { ContentImage } from './ContentImage';
export function NewsDetailScreen({
  service,
  token,
  id,
  onBack,
}: {
  service: ContentService;
  token: string | null;
  id: string;
  onBack(): void;
}) {
  const state = useFocusedResource(
    useCallback(
      () =>
        token
          ? service.article(token, id)
          : Promise.reject(new Error(copy.playerProfile.sessionError)),
      [service, token, id],
    ),
  );
  return (
    <Screen>
      <TopBar title={copy.news.title} onBack={onBack} />
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
            <View style={styles.heading}>
              <Text style={styles.date}>
                {copy.news.date(state.data.createdAt)}
              </Text>
              <Text accessibilityRole="header" style={styles.title}>
                {state.data.title}
              </Text>
              {state.data.summary ? (
                <Text style={styles.summary}>{state.data.summary}</Text>
              ) : null}
            </View>
            {!!state.data.imageId && (
              <ContentImage
                uri={service.imageUrl(state.data.imageId)}
                label={state.data.title}
              />
            )}
            <Text style={styles.body}>{state.data.body}</Text>
          </>
        )
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  heading: { gap: space.sm },
  date: { ...type.caption, color: colors.muted },
  title: { ...type.title, color: colors.text },
  summary: { ...type.body, color: colors.secondary },
  body: { color: colors.secondary, fontSize: 15, lineHeight: 26 },
});
