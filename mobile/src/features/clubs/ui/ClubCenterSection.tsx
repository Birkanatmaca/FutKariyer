import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ChevronRight,
  ClipboardList,
  Newspaper,
  FileClock,
  type LucideIcon,
} from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import {
  kickoffLabel,
  completenessView,
  nextFixture,
  recentResults,
  resultLetter,
} from '../application/club-center';
import type { ClubService } from '../application/club-service';
import type {
  ClubCenter,
  ClubCenterLeague,
  ClubMatchResult,
  ClubRecentFixture,
} from '../domain/models';
import {
  clubStyles,
  ClubSection,
  EmptyText,
  SectionStatus,
  sessionError,
} from './ClubPrimitives';

// The center block loads on its own, like the other club home sections.
export function ClubCenterSection({
  token,
  service,
  onProfile,
  onApplications,
  onNews,
  onLeagues,
}: {
  token: string | null;
  service: ClubService;
  onProfile(): void;
  onApplications(): void;
  onNews(): void;
  onLeagues(): void;
}) {
  const state = useFocusedResource(
    useCallback(
      () => (token ? service.center(token) : sessionError()),
      [service, token],
    ),
  );
  const center = state.data;
  return (
    <ClubSection title={copy.clubHome.centerTitle}>
      <SectionStatus
        loading={state.loading}
        error={state.error}
        onRetry={state.retry}
      />
      {center ? (
        <View style={styles.stack}>
          <CompletenessCard center={center} onProfile={onProfile} />
          <WorkCounters
            center={center}
            onApplications={onApplications}
            onNews={onNews}
          />
          <LeagueStandings leagues={center.leagues} onLeagues={onLeagues} />
        </View>
      ) : null}
    </ClubSection>
  );
}

function CompletenessCard({
  center,
  onProfile,
}: {
  center: ClubCenter;
  onProfile(): void;
}) {
  const view = completenessView(center);
  return (
    <View style={clubStyles.card}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>{copy.clubHome.completenessTitle}</Text>
        <Text style={styles.percent}>
          {copy.clubHome.completenessValue(view.percent)}
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={copy.clubHome.completenessTitle}
        accessibilityValue={{ min: 0, max: 100, now: view.percent }}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${view.percent}%` }]} />
      </View>
      {view.complete ? (
        <Text style={styles.meta}>{copy.clubHome.profileComplete}</Text>
      ) : (
        <>
          <Text style={styles.meta}>{copy.clubHome.missingTitle}</Text>
          <View style={styles.chips}>
            {view.missing.map(field => (
              <View key={field} style={styles.chip}>
                <Text style={styles.chipText}>{field}</Text>
              </View>
            ))}
          </View>
          <Button
            label={copy.clubHome.completeProfile}
            secondary
            onPress={onProfile}
          />
        </>
      )}
    </View>
  );
}

function WorkCounters({
  center,
  onApplications,
  onNews,
}: {
  center: ClubCenter;
  onApplications(): void;
  onNews(): void;
}) {
  return (
    <View style={styles.stack}>
      <Text accessibilityRole="header" style={styles.subTitle}>
        {copy.clubHome.workTitle}
      </Text>
      <View style={styles.counters}>
        <CounterTile
          icon={ClipboardList}
          count={center.pendingApplications}
          label={copy.clubHome.workApplications}
          onPress={onApplications}
        />
        <CounterTile
          icon={FileClock}
          count={center.pendingNews}
          label={copy.clubHome.workPendingNews}
          onPress={onNews}
        />
        <CounterTile
          icon={Newspaper}
          count={center.publishedNews}
          label={copy.clubHome.workPublishedNews}
          onPress={onNews}
        />
      </View>
    </View>
  );
}

function CounterTile({
  icon: Icon,
  count,
  label,
  onPress,
}: {
  icon: LucideIcon;
  count: number;
  label: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label + ': ' + count}
      onPress={onPress}
      style={({ pressed }) => [styles.counter, pressed && styles.pressed]}
    >
      <Icon size={16} color={colors.brand} />
      <Text style={styles.counterValue}>{count}</Text>
      <Text style={styles.counterLabel}>{label}</Text>
    </Pressable>
  );
}

function LeagueStandings({
  leagues,
  onLeagues,
}: {
  leagues: ClubCenterLeague[];
  onLeagues(): void;
}) {
  return (
    <View style={styles.stack}>
      <View style={styles.subHeading}>
        <Text accessibilityRole="header" style={styles.subTitle}>
          {copy.clubHome.standingsTitle}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            copy.clubHome.standingsTitle + ': ' + copy.clubHome.viewAll
          }
          onPress={onLeagues}
          style={styles.link}
        >
          <Text style={styles.linkText}>{copy.clubHome.viewAll}</Text>
          <ChevronRight size={16} color={colors.brand} />
        </Pressable>
      </View>
      {leagues.length ? (
        leagues.map(league => (
          <LeagueCard
            key={league.leagueId}
            league={league}
            onPress={onLeagues}
          />
        ))
      ) : (
        <EmptyText>{copy.clubHome.leagueEmpty}</EmptyText>
      )}
    </View>
  );
}

function LeagueCard({
  league,
  onPress,
}: {
  league: ClubCenterLeague;
  onPress(): void;
}) {
  const next = nextFixture(league);
  const recent = recentResults(league);
  const difference =
    league.goalDifference > 0
      ? '+' + league.goalDifference
      : String(league.goalDifference);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={league.leagueName + ', ' + copy.clubHome.openLeague}
      onPress={onPress}
      style={({ pressed }) => [clubStyles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={styles.rowTitle}>
            {league.leagueName}
          </Text>
          <Text style={styles.meta}>
            {copy.leagues.season}: {league.season} ·{' '}
            {copy.clubHome.leagueStatus[league.status]}
          </Text>
        </View>
        <Text style={styles.position}>
          {copy.clubHome.leaguePosition(league.position, league.teamCount)}
        </Text>
      </View>
      <Text style={styles.stats}>
        {copy.clubHome.leaguePoints}: {league.points} ·{' '}
        {copy.clubHome.leagueRecord}: {league.wins}-{league.draws}-
        {league.losses} · {copy.clubHome.leagueGoalDifference}: {difference}
      </Text>
      <View style={styles.recent}>
        <Text style={styles.meta}>{copy.clubHome.leagueRecent}</Text>
        {recent.length ? (
          <View style={styles.badges}>
            {recent.map(match => (
              <ResultBadge key={match.id} match={match} />
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>{copy.clubHome.leagueNoRecent}</Text>
        )}
      </View>
      <Text style={styles.meta}>
        {copy.clubHome.leagueNext}:{' '}
        {next
          ? (next.isHome ? copy.clubHome.homeMatch : copy.clubHome.awayMatch) +
            ' · ' +
            next.opponentName +
            ' · ' +
            kickoffLabel(next.kickoffAt)
          : copy.clubHome.leagueNoUpcoming}
      </Text>
    </Pressable>
  );
}

const resultTone: Record<ClubMatchResult, string> = {
  win: colors.success,
  draw: colors.warning,
  loss: colors.danger,
};

// The letter carries the result, so the color is never the only signal.
function ResultBadge({ match }: { match: ClubRecentFixture }) {
  const tone = resultTone[match.result];
  return (
    <View
      accessible
      accessibilityLabel={
        copy.clubHome.resultName[match.result] +
        ', ' +
        match.goalsFor +
        '-' +
        match.goalsAgainst +
        ' ' +
        match.opponentName
      }
      style={[styles.badge, { borderColor: tone }]}
    >
      <Text style={[styles.badgeText, { color: tone }]}>
        {resultLetter(match.result)} {match.goalsFor}-{match.goalsAgainst}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  titleBlock: { flex: 1, gap: space.xs },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  percent: { color: colors.brand, fontSize: 13, fontWeight: '700' },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
  },
  chipText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  counters: { flexDirection: 'row', gap: space.sm },
  counter: {
    flex: 1,
    minHeight: 96,
    padding: space.md,
    gap: space.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.75 },
  counterValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  counterLabel: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  subHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: space.sm,
  },
  subTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 44,
  },
  linkText: { color: colors.brand, fontSize: 12, fontWeight: '600' },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  position: { color: colors.brand, fontSize: 15, fontWeight: '800' },
  stats: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  recent: { gap: space.xs },
  badges: { flexDirection: 'row', gap: space.sm },
  badge: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
