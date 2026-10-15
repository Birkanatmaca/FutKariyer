import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Megaphone } from 'lucide-react-native';
import { BackLink } from '../../../shared/ui/BackLink';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Screen } from '../../../shared/ui/Screen';
import { copy } from '../../../shared/lib/copy';
import { colors, space } from '../../../styles/tokens';
import type { ListingsService } from '../application/listings-service';
import { useListingFeed } from '../application/useListingFeed';
import type { ListingFilter } from '../domain/models';
import { ListingCard, ListingFilterBar } from './ListingParts';

const text = copy.listings;

export function ListingsScreen({
  token,
  service,
  onBack,
  onOpen,
}: {
  token: string;
  service: ListingsService;
  onBack(): void;
  onOpen(id: string): void;
}) {
  const [filter, setFilter] = useState<ListingFilter>('');
  const feed = useListingFeed(service, token, filter);
  return (
    <Screen>
      <BackLink label={copy.form.back} onPress={onBack} />
      <PageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        hint={text.description}
      />
      <ListingFilterBar value={filter} onChange={setFilter} />
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
          {feed.items.map(listing => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onOpen={() => onOpen(listing.id)}
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
          icon={Megaphone}
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
