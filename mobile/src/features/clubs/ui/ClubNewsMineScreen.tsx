import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FileText } from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Screen } from '../../../shared/ui/Screen';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import type { ClubArticle, ClubReviewStatus } from '../domain/models';
import type { ClubService } from '../application/club-service';
import { BackLink, SectionStatus } from './ClubPrimitives';

const statusColor: Record<ClubReviewStatus, string> = {
  pending: colors.warning,
  approved: colors.success,
  rejected: colors.danger,
};

export function ClubNewsMineScreen({
  token,
  service,
  onBack,
  onCompose,
}: {
  token: string;
  service: ClubService;
  onBack(): void;
  onCompose(): void;
}) {
  const load = useCallback(() => service.news(token), [service, token]);
  const state = useFocusedResource(load);
  return (
    <Screen>
      <BackLink label={copy.form.back} onPress={onBack} />
      <PageHeader
        eyebrow={copy.clubNews.eyebrow}
        title={copy.clubNews.mineTitle}
        hint={copy.clubNews.mineDescription}
      />
      <Button label={copy.clubNews.composeTitle} onPress={onCompose} />
      <SectionStatus
        loading={state.loading}
        error={state.error}
        onRetry={state.retry}
      />
      {state.data ? (
        state.data.length ? (
          <View style={styles.list}>
            {state.data.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon={FileText}
            title={copy.clubNews.mineEmptyTitle}
            body={copy.clubNews.mineEmptyBody}
          />
        )
      ) : null}
    </Screen>
  );
}

function ArticleCard({ article }: { article: ClubArticle }) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.date}>{copy.news.date(article.createdAt)}</Text>
        <Text
          style={[styles.status, { color: statusColor[article.reviewStatus] }]}
        >
          {copy.clubNews.status[article.reviewStatus]}
        </Text>
      </View>
      <Text numberOfLines={2} style={styles.title}>
        {article.title}
      </Text>
      <Text numberOfLines={2} style={styles.summary}>
        {article.summary}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  card: {
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  date: { color: colors.muted, fontSize: 11 },
  status: { fontSize: 12, fontWeight: '700' },
  title: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  summary: { color: colors.secondary, fontSize: 13, lineHeight: 19 },
});
