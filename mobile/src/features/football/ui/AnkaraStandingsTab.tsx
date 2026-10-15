import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Clock3, History, MapPin } from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import type {
  AnkaraLeagues,
  AnkaraMatch,
  AnkaraOption,
  AnkaraPicker,
  AnkaraQuery,
} from '../domain/models';
import {
  ankaraSelection,
  defaultWeek,
  groupAnkaraLeagues,
  hasAnkaraGroups,
  previousAnkaraSeason,
  seasonsNewestFirst,
} from '../domain/rules';
import type { FootballError } from '../application/useFootballResource';
import {
  Chip,
  ChipRow,
  leagueGroupIcon,
  leagueGroupLabel,
  leagueGroupTone,
} from './AnkaraChips';
import { AnkaraSelect, SelectOption, SelectSection } from './AnkaraSelect';
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  SectionTitle,
  UpdatedLabel,
} from './FootballStates';
import { StandingsTable } from './StandingsTable';

const text = copy.footballData;

export function AnkaraStandingsTab({
  data,
  error,
  query,
  loading,
  retry,
  select,
}: {
  data: AnkaraLeagues | null;
  query: AnkaraQuery;
  error: FootballError | null;
  loading: boolean;
  retry(): void;
  select(picker: AnkaraPicker, id: string): void;
}) {
  return (
    <>
      {data ? (
        <Pickers data={data} query={query} loading={loading} select={select} />
      ) : null}
      {loading && !data ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock error={error} onRetry={retry} />
      ) : data ? (
        <>
          {loading ? (
            <ActivityIndicator
              accessibilityLabel={text.loading}
              color={colors.brand}
            />
          ) : null}
          <StandingsContent data={data} />
        </>
      ) : null}
    </>
  );
}

function Pickers({
  data,
  query,
  loading,
  select,
}: {
  data: AnkaraLeagues;
  query: AnkaraQuery;
  loading: boolean;
  select(picker: AnkaraPicker, id: string): void;
}) {
  const [open, setOpen] = useState<AnkaraPicker | null>(null);
  const toggle = (picker: AnkaraPicker) =>
    setOpen(current => (current === picker ? null : picker));
  const choose = (picker: AnkaraPicker, id: string, selected: boolean) => {
    setOpen(null);
    if (!selected) select(picker, id);
  };
  const current = ankaraSelection(data, query, loading);
  const previous = previousAnkaraSeason(data);
  const groupName = (group: AnkaraOption) =>
    group.id === '0' ? text.noGroup : group.name;
  return (
    <View style={styles.pickers}>
      <AnkaraSelect
        step={1}
        label={text.seasonLabel}
        value={current.season?.name ?? null}
        open={open === 'season'}
        busy={loading}
        onToggle={() => toggle('season')}
        accessory={
          previous && !loading ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text.previousSeason(previous.name)}
              accessibilityHint={text.previousSeasonHint}
              onPress={() => choose('season', previous.id, false)}
              style={({ pressed }) => [
                styles.previous,
                pressed && styles.pressed,
              ]}
            >
              <History size={16} color={colors.secondary} />
              <Text style={styles.previousText}>{text.previousShort}</Text>
            </Pressable>
          ) : null
        }
      >
        {seasonsNewestFirst(data.seasons).map(season => (
          <SelectOption
            key={season.id}
            label={season.name}
            selected={season.id === current.season?.id}
            onPress={() =>
              choose('season', season.id, season.id === current.season?.id)
            }
          />
        ))}
      </AnkaraSelect>
      <AnkaraSelect
        step={2}
        label={text.leagueLabel}
        value={current.league?.name ?? null}
        open={open === 'league'}
        locked={!current.season}
        busy={loading}
        onToggle={() => toggle('league')}
      >
        {groupAnkaraLeagues(data.leagues).map(({ group, leagues }) => (
          <View key={group}>
            <SelectSection
              label={leagueGroupLabel(group)}
              icon={leagueGroupIcon[group]}
              tone={leagueGroupTone[group]}
            />
            {leagues.map(league => (
              <SelectOption
                key={league.id}
                label={league.name}
                tone={leagueGroupTone[group]}
                selected={league.id === current.league?.id}
                onPress={() =>
                  choose('league', league.id, league.id === current.league?.id)
                }
              />
            ))}
          </View>
        ))}
      </AnkaraSelect>
      {hasAnkaraGroups(data.groups) ? (
        <AnkaraSelect
          step={3}
          label={text.groupLabel}
          value={current.group ? groupName(current.group) : null}
          open={open === 'group'}
          locked={!current.league}
          busy={loading}
          onToggle={() => toggle('group')}
        >
          {data.groups.map(group => (
            <SelectOption
              key={group.id}
              label={groupName(group)}
              selected={group.id === current.group?.id}
              onPress={() =>
                choose('group', group.id, group.id === current.group?.id)
              }
            />
          ))}
        </AnkaraSelect>
      ) : null}
    </View>
  );
}

function StandingsContent({ data }: { data: AnkaraLeagues }) {
  const [week, setWeek] = useState(() => defaultWeek(data));
  useEffect(() => setWeek(defaultWeek(data)), [data]);
  const matches = data.weeks.find(item => item.number === week)?.matches ?? [];
  const league = data.leagues.find(item => item.selected)?.name;
  const group = data.groups.find(item => item.selected && item.id !== '0');
  return (
    <>
      <SectionTitle
        title={
          [league, group?.name].filter(Boolean).join(' · ') ||
          text.ankaraStandings
        }
      />
      {data.standings.length ? (
        <StandingsTable rows={data.standings} />
      ) : (
        <EmptyBlock body={text.ankaraEmpty} />
      )}
      {data.weeks.length ? (
        <>
          <SectionTitle title={text.schedule} />
          <ChipRow label={text.schedule}>
            {data.weeks.map(item => (
              <Chip
                key={item.number}
                label={text.weekShort(item.number)}
                accessibilityLabel={text.selectWeek(item.number)}
                selected={item.number === week}
                onPress={() => setWeek(item.number)}
              />
            ))}
          </ChipRow>
          <Text style={styles.weekTitle}>{text.week(week)}</Text>
          {matches.length ? (
            <View style={styles.matches}>
              {matches.map((match, index) => (
                <MatchCard
                  key={index + match.home + match.away}
                  match={match}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.helper}>{text.scheduleEmpty}</Text>
          )}
        </>
      ) : null}
      <UpdatedLabel at={data.updatedAt} />
    </>
  );
}

function MatchCard({ match }: { match: AnkaraMatch }) {
  const played = match.homeGoals !== null && match.awayGoals !== null;
  const score = played
    ? match.homeGoals + ' - ' + match.awayGoals
    : text.notPlayed;
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={[
        match.date,
        match.time,
        match.venue,
        match.home + ' ' + score + ' ' + match.away,
        match.status,
      ]
        .filter(Boolean)
        .join(', ')}
    >
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Clock3 size={13} color={colors.muted} />
          <Text style={styles.metaText}>
            {[match.date, match.time].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {match.status && match.status !== '-' ? (
          <Text style={styles.status}>{match.status}</Text>
        ) : null}
      </View>
      <View style={styles.teams}>
        <Text numberOfLines={2} style={styles.team}>
          {match.home}
        </Text>
        <View style={[styles.scoreBox, played && styles.scorePlayed]}>
          <Text style={[styles.score, !played && styles.pending]}>{score}</Text>
        </View>
        <Text numberOfLines={2} style={[styles.team, styles.away]}>
          {match.away}
        </Text>
      </View>
      {match.venue ? (
        <View style={styles.metaItem}>
          <MapPin size={13} color={colors.muted} />
          <Text numberOfLines={2} style={styles.metaText}>
            {match.venue}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pickers: { gap: space.md },
  previous: {
    minWidth: 58,
    minHeight: 58,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  previousText: { color: colors.secondary, fontSize: 10, fontWeight: '700' },
  pressed: { opacity: 0.85 },
  weekTitle: { ...type.headline, fontSize: 15, color: colors.text },
  matches: { gap: space.md },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    padding: space.lg,
    gap: space.md,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    flexShrink: 1,
  },
  metaText: { color: colors.muted, fontSize: 11, flexShrink: 1 },
  status: { color: colors.secondary, fontSize: 11, fontWeight: '800' },
  teams: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  team: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  away: { textAlign: 'right' },
  scoreBox: {
    minWidth: 64,
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
    alignItems: 'center',
  },
  scorePlayed: { borderWidth: 1, borderColor: colors.brandSoft },
  score: {
    ...type.number,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  pending: { color: colors.muted },
  helper: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
});
