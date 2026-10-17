import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RefreshCw, Trophy } from 'lucide-react-native';
import { useAuth } from '../../auth';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { League } from '../domain/models';
import { createLeagueService } from '../application/league-service';
import { leagueRepository } from '../data/http-league-repository';

const service = createLeagueService(leagueRepository);
const CARD_WIDTH = 112;

// Swipeable row of the admin-published Fut Career leagues (first page); the
// app shell places it on the Ligler landing screen and opens the detail route.
export function LeagueRail({ onOpen }: { onOpen(league: League): void }) {
  const { token } = useAuth();
  const load = useCallback(() => {
    if (!token) throw new Error(copy.form.sessionError);
    return service.list(token, 1);
  }, [token]);
  const { data, error, loading, retry } = useFocusedResource(load);
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  if (error) {
    return (
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
    );
  }
  if (!data) return null;
  if (!data.items.length) {
    return <Text style={styles.empty}>{copy.leagues.emptyTitle}</Text>;
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={CARD_WIDTH + space.md}
      contentContainerStyle={styles.rail}
      style={styles.bleed}
    >
      {data.items.map(item => (
        <LeagueCard key={item.id} league={item} onPress={() => onOpen(item)} />
      ))}
    </ScrollView>
  );
}

function LeagueCard({ league, onPress }: { league: League; onPress(): void }) {
  const finished = league.status === 'finished';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.leagues.detail + ': ' + league.name}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Trophy size={20} color={colors.brand} />
      </View>
      <Text numberOfLines={2} style={styles.name}>
        {league.name}
      </Text>
      <View style={styles.meta}>
        <View style={[styles.dot, finished && styles.dotDone]} />
        <Text numberOfLines={1} style={styles.season}>
          {league.season}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -space.xl },
  rail: { gap: space.md, paddingHorizontal: space.xl },
  loading: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.muted, fontSize: 13 },
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
    width: CARD_WIDTH,
    minHeight: 112,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    padding: space.md,
    gap: 2,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  name: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  dotDone: { backgroundColor: colors.muted },
  season: {
    ...type.caption,
    fontSize: 11,
    color: colors.muted,
    flexShrink: 1,
  },
});
