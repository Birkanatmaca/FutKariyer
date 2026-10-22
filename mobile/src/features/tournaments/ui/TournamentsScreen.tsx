import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Medal } from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { TopBar } from '../../../shared/ui/TopBar';
import { Screen } from '../../../shared/ui/Screen';
import { copy } from '../../../shared/lib/copy';
import { colors, space } from '../../../styles/tokens';
import type { TournamentsService } from '../application/tournaments-service';
import { useTournamentFeed } from '../application/useTournamentFeed';
import type { TournamentFeedView } from '../domain/models';
import { TournamentCard } from './TournamentParts';

const text = copy.tournaments;

export function TournamentsScreen({
  token,
  service,
  view = 'open',
  onBack,
  onOpen,
}: {
  token: string;
  service: TournamentsService;
  // 'halisaha' lists open, running and finished halı saha leagues (Ligler).
  view?: TournamentFeedView;
  onBack(): void;
  onOpen(id: string): void;
}) {
  const feed = useTournamentFeed(service, token, view);
  const league = view === 'halisaha';
  return (
    <Screen>
      <TopBar
        title={league ? text.halisahaTitle : text.title}
        onBack={onBack}
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
          <Text style={styles.count}>
            {league
              ? text.halisahaResults(feed.total)
              : text.results(feed.total)}
          </Text>
          {feed.items.map(tournament => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              showOrganizer
              league={league}
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
          title={league ? text.halisahaEmptyTitle : text.emptyTitle}
          body={league ? text.halisahaEmptyBody : text.emptyBody}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  count: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
