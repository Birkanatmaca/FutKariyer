import React, { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius } from '../../../styles/tokens';
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.form.back}
        onPress={onBack}
        style={styles.back}
      >
        <ArrowLeft size={20} color={colors.text} />
      </Pressable>
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
            <PageHeader
              eyebrow={copy.news.date(state.data.createdAt)}
              title={state.data.title}
              description={state.data.summary}
            />
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
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { color: colors.secondary, fontSize: 15, lineHeight: 26 },
});
