import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowRight, RefreshCw, Trophy } from 'lucide-react-native';
import { useAuth } from '../../auth';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import type { League } from '../domain/models';
import { createLeagueService } from '../application/league-service';
import { leagueRepository } from '../data/http-league-repository';

const service = createLeagueService(leagueRepository);
// Paged list of admin-published Fut Career leagues; the app shell places it
// on the Ligler landing screen and opens the detail route.
export function LeagueList({ onOpen }: { onOpen(league: League): void }) {
  const { token } = useAuth();
  const [pageNumber, setPageNumber] = useState(1);
  const load = useCallback(() => {
    if (!token) throw new Error(copy.form.sessionError);
    return service.list(token, pageNumber);
  }, [token, pageNumber]);
  const { data, error, loading, retry } = useFocusedResource(load);
  return (
    <>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.helper}>{copy.leagues.loading}</Text>
        </View>
      ) : error ? (
        <>
          <ErrorBanner message={error} />
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={styles.retry}
          >
            <RefreshCw size={16} color={colors.brand} />
            <Text style={styles.retryText}>{copy.leagues.refresh}</Text>
          </Pressable>
        </>
      ) : data ? (
        <>
          <View style={styles.resultHeader}>
            <Text style={styles.helper}>
              {copy.leagues.results(data.total)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.leagues.refresh}
              hitSlop={12}
              onPress={retry}
              style={styles.refresh}
            >
              <RefreshCw size={16} color={colors.secondary} />
            </Pressable>
          </View>
          {data.items.length ? (
            data.items.map(item => (
              <LeagueCard
                key={item.id}
                league={item}
                onPress={() => onOpen(item)}
              />
            ))
          ) : (
            <EmptyState
              icon={Trophy}
              title={copy.leagues.emptyTitle}
              body={copy.leagues.emptyBody}
            />
          )}
          {(data.totalPages > 1 || pageNumber > 1) && (
            <View style={styles.pagination}>
              <PageButton
                label={copy.leagues.previous}
                disabled={pageNumber <= 1}
                onPress={() => setPageNumber(value => value - 1)}
              />
              <Text style={styles.helper}>
                {copy.leagues.page(pageNumber, data.totalPages)}
              </Text>
              <PageButton
                label={copy.leagues.next}
                disabled={pageNumber >= data.totalPages}
                onPress={() => setPageNumber(value => value + 1)}
              />
            </View>
          )}
        </>
      ) : null}
    </>
  );
}

function LeagueCard({ league, onPress }: { league: League; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.leagues.detail + ': ' + league.name}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardIcon}>
        <Trophy size={22} color={colors.brand} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardTitleLine}>
          <Text numberOfLines={2} style={styles.cardTitle}>
            {league.name}
          </Text>
          <Text
            style={[
              styles.status,
              league.status === 'finished' && styles.finished,
            ]}
          >
            {copy.leagues[league.status]}
          </Text>
        </View>
        <Text style={styles.season}>
          {copy.leagues.season}: {league.season}
        </Text>
        {league.description ? (
          <Text numberOfLines={2} style={styles.description}>
            {league.description}
          </Text>
        ) : null}
      </View>
      <ArrowRight color={colors.muted} size={19} />
    </Pressable>
  );
}
function PageButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.pageButton, disabled && styles.disabled]}
    >
      <Text style={styles.pageText}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  loading: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  helper: { color: colors.secondary, fontSize: 12 },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refresh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 40,
    paddingHorizontal: space.sm,
  },
  retry: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
  retryText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    padding: space.lg,
    gap: space.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1, minWidth: 0, gap: space.xs },
  cardTitleLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    flex: 1,
  },
  status: {
    color: colors.success,
    fontSize: 9,
    letterSpacing: 0.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    paddingTop: 4,
  },
  finished: { color: colors.secondary },
  season: { color: colors.brand, fontSize: 12, fontWeight: '600' },
  description: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  pageButton: {
    minHeight: 44,
    minWidth: 82,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.82 },
});
