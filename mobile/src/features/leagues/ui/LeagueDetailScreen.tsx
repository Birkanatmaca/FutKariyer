import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Trophy,
} from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import type { LeagueDetail, LeagueMatch } from '../domain/models';
import { createLeagueService } from '../application/league-service';
import { leagueRepository } from '../data/http-league-repository';

const service = createLeagueService(leagueRepository);
export function LeagueDetailScreen({
  token,
  id,
  onBack,
}: {
  token: string;
  id: string;
  onBack(): void;
}) {
  const load = useCallback(() => service.detail(token, id), [token, id]);
  const { data, error, loading, retry } = useFocusedResource(load);
  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.leagues.back}
        onPress={onBack}
        style={styles.back}
      >
        <ArrowLeft size={20} color={colors.text} />
        <Text style={styles.backText}>{copy.leagues.back}</Text>
      </Pressable>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>{copy.leagues.loading}</Text>
        </View>
      ) : error ? (
        <>
          <ErrorBanner message={error} />
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={styles.retry}
          >
            <Text style={styles.retryText}>{copy.form.retry}</Text>
          </Pressable>
        </>
      ) : data ? (
        <Detail detail={data} />
      ) : null}
    </Screen>
  );
}

function Detail({ detail }: { detail: LeagueDetail }) {
  const { league, statistics } = detail;
  const fixtures = new Map<number, LeagueMatch[]>();
  for (const match of detail.matches)
    fixtures.set(match.round, [...(fixtures.get(match.round) || []), match]);
  return (
    <>
      <PageHeader
        eyebrow={copy.leagues.eyebrow + ' · ' + league.season}
        title={league.name}
        description={league.description || undefined}
      />
      <View style={styles.statusLine}>
        <Trophy
          size={15}
          color={league.status === 'finished' ? colors.secondary : colors.brand}
        />
        <Text style={styles.muted}>{copy.leagues[league.status]}</Text>
        <Text style={styles.rule}>
          • {league.winPoints}/{league.drawPoints}/{league.lossPoints}{' '}
          {copy.leagues.points}
        </Text>
      </View>
      <View style={styles.sectionTitle}>
        <BarChart3 size={17} color={colors.brand} />
        <Text style={styles.sectionHeading}>{copy.leagues.statistics}</Text>
      </View>
      <View style={styles.statsGrid}>
        <Metric label={copy.leagues.teamCount} value={statistics.teamCount} />
        <Metric
          label={copy.leagues.playedMatches}
          value={statistics.playedMatches}
        />
        <Metric
          label={copy.leagues.scheduledMatches}
          value={statistics.scheduledMatches}
        />
        <Metric label={copy.leagues.totalGoals} value={statistics.totalGoals} />
        <Metric
          label={copy.leagues.averageGoals}
          value={statistics.averageGoals.toFixed(2)}
        />
        <Metric label={copy.leagues.matchCount} value={statistics.matchCount} />
      </View>
      <View style={styles.outcomes}>
        <Text style={styles.outcomeText}>
          {copy.leagues.homeWins}:{' '}
          <Text style={styles.outcomeValue}>{statistics.homeWins}</Text>
        </Text>
        <Text style={styles.outcomeText}>
          {copy.leagues.draws}:{' '}
          <Text style={styles.outcomeValue}>{statistics.draws}</Text>
        </Text>
        <Text style={styles.outcomeText}>
          {copy.leagues.awayWins}:{' '}
          <Text style={styles.outcomeValue}>{statistics.awayWins}</Text>
        </Text>
      </View>

      <View style={styles.sectionTitle}>
        <Trophy size={17} color={colors.brand} />
        <Text style={styles.sectionHeading}>{copy.leagues.standings}</Text>
      </View>
      {detail.standings.length ? (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHead, styles.rank]}>
              {copy.leagues.position}
            </Text>
            <Text style={[styles.tableHead, styles.teamColumn]}>
              {copy.leagues.team}
            </Text>
            <Text style={[styles.tableHead, styles.smallColumn]}>
              {copy.leagues.playedShort}
            </Text>
            <Text style={[styles.tableHead, styles.smallColumn]}>
              {copy.leagues.winsShort}
            </Text>
            <Text style={[styles.tableHead, styles.smallColumn]}>
              {copy.leagues.drawsShort}
            </Text>
            <Text style={[styles.tableHead, styles.smallColumn]}>
              {copy.leagues.lossesShort}
            </Text>
            <Text style={[styles.tableHead, styles.goalColumn]}>
              {copy.leagues.goalDifference}
            </Text>
            <Text style={[styles.tableHead, styles.pointsColumn]}>
              {copy.leagues.pointsShort}
            </Text>
          </View>
          {detail.standings.map(row => (
            <View key={row.teamId} style={styles.tableRow}>
              <Text style={[styles.rank, styles.rankValue]}>
                {row.position}
              </Text>
              <View style={styles.teamColumn}>
                <Text numberOfLines={1} style={styles.teamName}>
                  {row.teamName}
                </Text>
                <Text style={styles.goalDetail}>
                  {row.goalsFor}:{row.goalsAgainst}
                </Text>
              </View>
              <Text style={[styles.smallColumn, styles.cell]}>
                {row.played}
              </Text>
              <Text style={[styles.smallColumn, styles.cell]}>{row.wins}</Text>
              <Text style={[styles.smallColumn, styles.cell]}>{row.draws}</Text>
              <Text style={[styles.smallColumn, styles.cell]}>
                {row.losses}
              </Text>
              <Text style={[styles.goalColumn, styles.cell]}>
                {row.goalDifference > 0 ? '+' : ''}
                {row.goalDifference}
              </Text>
              <Text style={[styles.pointsColumn, styles.points]}>
                {row.points}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState
          icon={Trophy}
          title={copy.leagues.noTeams}
          body={copy.leagues.noTeams}
        />
      )}

      <View style={styles.sectionTitle}>
        <CalendarDays size={17} color={colors.brand} />
        <Text style={styles.sectionHeading}>{copy.leagues.fixtures}</Text>
      </View>
      {fixtures.size ? (
        Array.from(fixtures.entries())
          .sort(([a], [b]) => a - b)
          .map(([round, matches]) => (
            <View key={round} style={styles.roundBlock}>
              <Text style={styles.roundTitle}>{copy.leagues.round(round)}</Text>
              {matches.map(match => (
                <Fixture key={match.id} match={match} />
              ))}
            </View>
          ))
      ) : (
        <EmptyState
          icon={CalendarDays}
          title={copy.leagues.noMatches}
          body={
            detail.teams.length ? copy.leagues.noMatches : copy.leagues.noTeams
          }
        />
      )}
    </>
  );
}
function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text numberOfLines={2} style={styles.metricLabel}>
        {label}
      </Text>
    </View>
  );
}
function Fixture({ match }: { match: LeagueMatch }) {
  const played = match.homeGoals !== null;
  const date = match.kickoffAt
    ? new Date(match.kickoffAt).toLocaleString('tr-TR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  return (
    <View style={styles.fixture}>
      <View style={styles.fixtureTop}>
        <Text style={styles.fixtureStatus}>
          {played ? copy.leagues.played : copy.leagues.scheduled}
        </Text>
        {date ? <Text style={styles.fixtureDate}>{date}</Text> : null}
      </View>
      <View style={styles.fixtureRow}>
        <Text numberOfLines={2} style={styles.fixtureTeam}>
          {match.homeName}
        </Text>
        <Text style={[styles.score, played && styles.completedScore]}>
          {played ? match.homeGoals + ' : ' + match.awayGoals : '— : —'}
        </Text>
        <Text numberOfLines={2} style={[styles.fixtureTeam, styles.away]}>
          {match.awayName}
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  loading: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  muted: { color: colors.secondary, fontSize: 12 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rule: { color: colors.muted, fontSize: 11, flex: 1 },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  sectionHeading: { color: colors.text, fontSize: 18, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  metric: {
    width: '30%',
    minHeight: 86,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    justifyContent: 'space-between',
  },
  metricValue: { color: colors.brand, fontSize: 22, fontWeight: '800' },
  metricLabel: { color: colors.secondary, fontSize: 10, lineHeight: 14 },
  outcomes: {
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    gap: space.xs,
  },
  outcomeText: { color: colors.secondary, fontSize: 12 },
  outcomeValue: { color: colors.text, fontWeight: '700' },
  table: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  tableHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    backgroundColor: colors.raised,
  },
  tableHead: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  tableRow: {
    minHeight: 51,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rank: { width: 22, textAlign: 'center' },
  rankValue: { color: colors.secondary, fontSize: 11, fontWeight: '700' },
  teamColumn: { flex: 1, minWidth: 48, paddingHorizontal: 3 },
  smallColumn: { width: '8.3%', textAlign: 'center' },
  goalColumn: { width: '10%', textAlign: 'center' },
  pointsColumn: { width: '10%', textAlign: 'center' },
  cell: { color: colors.secondary, fontSize: 10 },
  teamName: { color: colors.text, fontSize: 10, fontWeight: '700' },
  goalDetail: { color: colors.muted, fontSize: 9, marginTop: 2 },
  points: { color: colors.brand, fontSize: 12, fontWeight: '800' },
  roundBlock: { gap: space.sm },
  roundTitle: { color: colors.brand, fontSize: 12, fontWeight: '800' },
  fixture: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: space.md,
    gap: space.sm,
  },
  fixtureTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  fixtureStatus: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  fixtureDate: { color: colors.secondary, fontSize: 10 },
  fixtureRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  fixtureTeam: { flex: 1, color: colors.text, fontSize: 11, fontWeight: '600' },
  away: { textAlign: 'right' },
  score: {
    minWidth: 58,
    textAlign: 'center',
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '800',
  },
  completedScore: { color: colors.brand },
  retry: {
    minHeight: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: colors.text, fontWeight: '700' },
});
