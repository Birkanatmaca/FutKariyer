import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space, type } from '../../../styles/tokens';
import { clockLabel, shortDay, startWeek } from '../application/club-center';
import type { ClubService } from '../application/club-service';
import type {
  ClubLeagueDetail,
  ClubLeagues,
  ClubMatch,
  ClubMatchResult,
  ClubWeekMatch,
} from '../domain/models';
import { ClubCrest, rivalCrest } from './ClubCrest';
import { sessionError } from './ClubPrimitives';

const text = copy.clubMatches;
type Section = 'fixture' | 'table' | 'weeks';
const sections: { key: Section; icon: LucideIcon }[] = [
  { key: 'fixture', icon: CalendarDays },
  { key: 'table', icon: ListOrdered },
  { key: 'weeks', icon: Users },
];

const resultTone: Record<ClubMatchResult, string> = {
  win: colors.success,
  draw: colors.warning,
  loss: colors.danger,
};

// Maçlarım (20 Oct 2026): the club's own league in the Ligler tab — its
// fixture, the whole table and every week of the group.
export function ClubMatchesView({
  token,
  service,
  clubName,
  avatarUri,
  onLinkTff,
}: {
  token: string | null;
  service: ClubService;
  clubName: string;
  avatarUri?: string;
  // Left out when a switched coach lacks the profile section.
  onLinkTff?(): void;
}) {
  const state = useFocusedResource(
    useCallback(
      () => (token ? service.leagues(token) : sessionError()),
      [service, token],
    ),
  );
  // A reload on focus keeps the last page on screen instead of a spinner.
  const [last, setLast] = useState<ClubLeagues | null>(null);
  useEffect(() => {
    if (state.data) setLast(state.data);
  }, [state.data]);
  const data = state.data ?? (state.loading ? last : null);
  const [leagueId, setLeagueId] = useState('');
  const league =
    data?.leagues.find(item => item.leagueId === leagueId) ??
    data?.leagues[0] ??
    null;
  if (state.error && !data) {
    return (
      <View style={styles.stack}>
        <ErrorBanner message={state.error} />
        <Button label={copy.form.retry} secondary onPress={state.retry} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.muted}>{text.loading}</Text>
      </View>
    );
  }
  if (!league) {
    const match = copy.clubHome.match;
    return (
      <View style={styles.card}>
        <View style={styles.emptyIcon}>
          <Trophy size={20} color={colors.brand} />
        </View>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          {data.tffLinked ? match.standingsTitle : match.linkTitle}
        </Text>
        <Text style={styles.body}>
          {data.tffLinked ? match.tffDown : match.linkBody}
        </Text>
        {data.tffLinked ? (
          <Button
            label={copy.form.retry}
            secondary
            compact
            onPress={state.retry}
          />
        ) : onLinkTff ? (
          <Button label={match.linkAction} compact onPress={onLinkTff} />
        ) : null}
      </View>
    );
  }
  return (
    <View style={styles.stack}>
      {data.leagues.length > 1 ? (
        <View style={styles.chips}>
          {data.leagues.map(item => {
            const selected = item.leagueId === league.leagueId;
            return (
              <Pressable
                key={item.leagueId}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setLeagueId(item.leagueId)}
                style={[styles.chip, selected && styles.chipOn]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.chipText, selected && styles.chipTextOn]}
                >
                  {item.leagueName}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <LeagueBody
        key={league.leagueId}
        league={league}
        clubName={clubName}
        avatarUri={avatarUri}
      />
    </View>
  );
}

function LeagueBody({
  league,
  clubName,
  avatarUri,
}: {
  league: ClubLeagueDetail;
  clubName: string;
  avatarUri?: string;
}) {
  const [section, setSection] = useState<Section>('fixture');
  return (
    <>
      <Summary league={league} clubName={clubName} avatarUri={avatarUri} />
      <View style={styles.segments} accessibilityRole="tablist">
        {sections.map(({ key, icon: Icon }) => {
          const selected = key === section;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setSection(key)}
              style={[styles.segment, selected && styles.segmentOn]}
            >
              <Icon size={15} color={selected ? colors.brand : colors.muted} />
              <Text
                numberOfLines={1}
                style={[styles.segmentText, selected && styles.segmentTextOn]}
              >
                {text.sections[key]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {section === 'fixture' ? (
        <Fixture league={league} />
      ) : section === 'table' ? (
        <Table league={league} />
      ) : (
        <Weeks league={league} />
      )}
      {league.source === 'tff' ? (
        <Text style={styles.source}>{copy.clubHome.match.tffSource}</Text>
      ) : null}
    </>
  );
}

function Summary({
  league,
  clubName,
  avatarUri,
}: {
  league: ClubLeagueDetail;
  clubName: string;
  avatarUri?: string;
}) {
  const difference =
    league.goalDifference > 0
      ? '+' + league.goalDifference
      : String(league.goalDifference);
  const stats: [string, string][] = [
    [text.position, league.position + '/' + league.teamCount],
    [text.points, String(league.points)],
    [text.played, String(league.played)],
    [text.record, league.wins + '-' + league.draws + '-' + league.losses],
    [text.difference, difference],
  ];
  return (
    <View style={styles.card}>
      <View style={styles.summaryTop}>
        <ClubCrest name={clubName} uri={avatarUri} own size={44} />
        <View style={styles.summaryTitle}>
          <Text style={styles.eyebrow}>
            {(
              text.source[league.source] +
              ' · ' +
              league.season
            ).toLocaleUpperCase('tr-TR')}
          </Text>
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            style={styles.cardTitle}
          >
            {league.leagueName}
          </Text>
        </View>
      </View>
      <View style={styles.stats}>
        {stats.map(([label, value], index) => (
          <View
            key={label}
            accessible
            accessibilityLabel={label + ': ' + value}
            style={[styles.stat, index > 0 && styles.statDivider]}
          >
            <Text
              style={[styles.statValue, index === 0 && styles.statValueBrand]}
            >
              {value}
            </Text>
            <Text numberOfLines={1} style={styles.statLabel}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Fixture({ league }: { league: ClubLeagueDetail }) {
  const next = league.matches.find(match => !match.result);
  if (!league.matches.length)
    return <Text style={styles.muted}>{text.noMatches}</Text>;
  return (
    <View style={styles.list}>
      {league.matches.map(match => (
        <FixtureRow key={match.id} match={match} next={match.id === next?.id} />
      ))}
    </View>
  );
}

function FixtureRow({ match, next }: { match: ClubMatch; next: boolean }) {
  const venue = match.venue || copy.clubHome.match.venueUnknown;
  const where = match.isHome
    ? copy.clubHome.match.home
    : copy.clubHome.match.away;
  const day = shortDay(match.kickoffAt);
  const time = clockLabel(match);
  return (
    <View style={[styles.row, next && styles.rowNext]}>
      <View style={styles.week}>
        <Text style={[styles.weekText, next && styles.weekTextNext]}>
          {text.weekShort(match.round)}
        </Text>
      </View>
      <ClubCrest
        name={match.opponentName}
        uri={rivalCrest(match)}
        own={false}
        size={36}
      />
      <View style={styles.rowText}>
        {next ? <Text style={styles.nextLabel}>{text.next}</Text> : null}
        <Text numberOfLines={1} style={styles.rowTitle}>
          {match.opponentName}
        </Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          {where} · {venue}
        </Text>
      </View>
      {match.result ? (
        <View style={styles.score}>
          <Text style={styles.scoreText}>
            {match.goalsFor}-{match.goalsAgainst}
          </Text>
          <View
            style={[styles.result, { borderColor: resultTone[match.result] }]}
          >
            <Text
              style={[styles.resultText, { color: resultTone[match.result] }]}
            >
              {copy.clubHome.resultLabel[match.result]}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.when}>
          <Text style={styles.whenDay}>{day || text.noDate}</Text>
          {time ? <Text style={styles.whenTime}>{time}</Text> : null}
        </View>
      )}
    </View>
  );
}

function Table({ league }: { league: ClubLeagueDetail }) {
  const t = text.table;
  const numbers: [keyof typeof t, string][] = [
    ['played', t.played],
    ['wins', t.wins],
    ['draws', t.draws],
    ['losses', t.losses],
    ['difference', t.difference],
  ];
  return (
    <View style={[styles.card, styles.table]}>
      <View style={styles.tr}>
        <Text style={[styles.th, styles.colPos]}>{t.position}</Text>
        <Text style={[styles.th, styles.colTeam]}>
          {t.team.toLocaleUpperCase('tr-TR')}
        </Text>
        {numbers.map(([key, label]) => (
          <Text key={key} style={[styles.th, styles.colNum]}>
            {label}
          </Text>
        ))}
        <Text style={[styles.th, styles.colNum]}>{t.points}</Text>
      </View>
      {league.standings.map(row => (
        <View
          key={row.position + row.teamName}
          style={[styles.tr, styles.trBody, row.own && styles.trOwn]}
        >
          <Text style={[styles.td, styles.colPos, row.own && styles.own]}>
            {row.position}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.td, styles.colTeam, row.own && styles.own]}
          >
            {row.teamName}
          </Text>
          <Text style={[styles.td, styles.colNum]}>{row.played}</Text>
          <Text style={[styles.td, styles.colNum]}>{row.wins}</Text>
          <Text style={[styles.td, styles.colNum]}>{row.draws}</Text>
          <Text style={[styles.td, styles.colNum]}>{row.losses}</Text>
          <Text style={[styles.td, styles.colNum]}>
            {row.goalDifference > 0
              ? '+' + row.goalDifference
              : row.goalDifference}
          </Text>
          <Text
            style={[
              styles.td,
              styles.colNum,
              styles.points,
              row.own && styles.own,
            ]}
          >
            {row.points}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Weeks({ league }: { league: ClubLeagueDetail }) {
  const [index, setIndex] = useState(() =>
    startWeek(league.weeks, league.currentWeek),
  );
  const week = league.weeks[index];
  if (!week) return <Text style={styles.muted}>{text.noMatches}</Text>;
  return (
    <View style={styles.list}>
      <View style={styles.stepper}>
        <StepButton
          icon={ChevronLeft}
          label={text.previousWeek}
          disabled={index === 0}
          onPress={() => setIndex(index - 1)}
        />
        <Text accessibilityRole="header" style={styles.stepperText}>
          {text.week(week.number)}
        </Text>
        <StepButton
          icon={ChevronRight}
          label={text.nextWeek}
          disabled={index === league.weeks.length - 1}
          onPress={() => setIndex(index + 1)}
        />
      </View>
      {week.matches.length ? (
        week.matches.map(match => <WeekRow key={match.id} match={match} />)
      ) : (
        <Text style={styles.muted}>{text.weekEmpty}</Text>
      )}
    </View>
  );
}

function StepButton({
  icon: Icon,
  label,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.step,
        disabled && styles.stepOff,
        pressed && styles.pressed,
      ]}
    >
      <Icon size={18} color={disabled ? colors.muted : colors.text} />
    </Pressable>
  );
}

function WeekRow({ match }: { match: ClubWeekMatch }) {
  const played = match.homeGoals !== null && match.awayGoals !== null;
  const day = shortDay(match.kickoffAt);
  const time = clockLabel(match);
  const meta = [day, match.venue].filter(Boolean).join(' · ');
  return (
    <View style={[styles.weekRow, match.own && styles.rowNext]}>
      <View style={styles.weekTeams}>
        <Text
          numberOfLines={2}
          style={[
            styles.weekTeam,
            styles.weekHome,
            match.own && styles.ownName,
          ]}
        >
          {match.homeName}
        </Text>
        <View style={[styles.weekMid, played && styles.weekMidPlayed]}>
          <Text style={[styles.weekMidText, played && styles.weekMidScore]}>
            {played
              ? match.homeGoals + ' - ' + match.awayGoals
              : time || copy.clubHome.match.versus}
          </Text>
        </View>
        <Text
          numberOfLines={2}
          style={[styles.weekTeam, match.own && styles.ownName]}
        >
          {match.awayName}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.weekMeta}>
        {meta || copy.clubHome.match.dateUnknown}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  loading: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  muted: { ...type.body, color: colors.muted },
  body: { ...type.body, color: colors.secondary },
  pressed: { opacity: 0.75 },
  card: {
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandWash,
  },
  cardTitle: { ...type.headline, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    maxWidth: '100%',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.brand, backgroundColor: colors.brandWash },
  chipText: { ...type.caption, color: colors.secondary, fontWeight: '700' },
  chipTextOn: { color: colors.brand },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  summaryTitle: { flex: 1, gap: 2 },
  eyebrow: { ...type.eyebrow, color: colors.brand },
  stats: {
    flexDirection: 'row',
    borderRadius: radius.md,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.sm,
  },
  statDivider: { borderLeftWidth: 1, borderLeftColor: colors.hairline },
  statValue: {
    ...type.number,
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  statValueBrand: { color: colors.brand },
  statLabel: { ...type.caption, fontSize: 10, color: colors.muted },
  segments: {
    flexDirection: 'row',
    padding: space.xs,
    gap: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderRadius: radius.pill,
    paddingHorizontal: space.xs,
  },
  segmentOn: { backgroundColor: colors.overlay },
  segmentText: { ...type.caption, color: colors.muted, fontWeight: '700' },
  segmentTextOn: { color: colors.text },
  list: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  rowNext: { borderColor: colors.brand, backgroundColor: colors.brandWash },
  week: {
    width: 40,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    alignItems: 'center',
    backgroundColor: colors.raised,
  },
  weekText: {
    ...type.caption,
    fontSize: 11,
    color: colors.muted,
    fontWeight: '800',
  },
  weekTextNext: { color: colors.brand },
  rowText: { flex: 1, gap: 2 },
  nextLabel: { ...type.eyebrow, fontSize: 9, color: colors.brand },
  rowTitle: { ...type.body, color: colors.text, fontWeight: '700' },
  rowMeta: { ...type.caption, color: colors.muted },
  score: { alignItems: 'flex-end', gap: 4 },
  scoreText: {
    ...type.number,
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  result: {
    minWidth: 22,
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 4,
  },
  resultText: { fontSize: 11, fontWeight: '800' },
  when: { alignItems: 'flex-end', gap: 2 },
  whenDay: { ...type.caption, color: colors.text, fontWeight: '700' },
  whenTime: { ...type.caption, ...type.number, color: colors.muted },
  table: { padding: space.md, gap: 2 },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
  },
  trBody: { minHeight: 32, borderRadius: radius.sm },
  trOwn: { backgroundColor: colors.brandWash },
  th: { ...type.eyebrow, fontSize: 9, color: colors.muted },
  td: { ...type.caption, ...type.number, color: colors.secondary },
  own: { color: colors.brand, fontWeight: '800' },
  points: { color: colors.text, fontWeight: '800' },
  colPos: { width: 20 },
  colTeam: { flex: 1 },
  colNum: { width: 24, textAlign: 'right' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperText: { ...type.headline, fontSize: 15, color: colors.text },
  step: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  stepOff: { opacity: 0.4 },
  weekRow: {
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  weekTeams: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  weekTeam: {
    ...type.caption,
    flex: 1,
    color: colors.secondary,
    fontWeight: '700',
  },
  weekHome: { textAlign: 'right' },
  ownName: { color: colors.text },
  weekMid: {
    minWidth: 58,
    alignItems: 'center',
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
  },
  weekMidPlayed: { backgroundColor: colors.overlay },
  weekMidText: { ...type.caption, ...type.number, color: colors.muted },
  weekMidScore: { color: colors.text, fontWeight: '800', fontSize: 14 },
  weekMeta: {
    ...type.caption,
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
  },
  source: { ...type.caption, fontSize: 10, color: colors.muted },
});
