import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Medal } from 'lucide-react-native';
import { BackLink } from '../../../shared/ui/BackLink';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Screen } from '../../../shared/ui/Screen';
import { copy } from '../../../shared/lib/copy';
import { colors, space } from '../../../styles/tokens';
import type { TournamentsService } from '../application/tournaments-service';
import { useTournamentFeed } from '../application/useTournamentFeed';
import { TournamentCard } from './TournamentParts';

const text = copy.tournaments;

export function TournamentsScreen({
  token,
  service,
  onBack,
  onOpen,
}: {
  token: string;
  service: TournamentsService;
  onBack(): void;
  onOpen(id: string): void;
}) {
  const feed = useTournamentFeed(service, token);
  return (
    <Screen>
      <BackLink label={copy.form.back} onPress={onBack} />
      <PageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        hint={text.description}
      />
      {feed.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : feed.error ? (
        <>
          <ErrorBanner message={feed.error} />
          <Button label={copy.form.retry} onPress={feed.retry} />
        </>
      ) : feed.items.length ? (
        <View style={styles.list}>
          <Text style={styles.count}>{text.results(feed.total)}</Text>
          {feed.items.map(tournament => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              showOrganizer
              onOpen={() => onOpen(tournament.id)}
            />
          ))}
          <ErrorBanner message={feed.moreError} />
          {feed.hasMore ? (
            <Button
              label={text.loadMore}
              secondary
              loading={feed.loadingMore}
              onPress={feed.loadMore}
            />
          ) : null}
        </View>
      ) : (
        <EmptyState
          icon={Medal}
          title={text.emptyTitle}
          body={text.emptyBody}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  count: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
