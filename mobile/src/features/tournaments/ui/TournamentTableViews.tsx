import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, ChevronRight, MapPin } from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import {
  isPlayed,
  matchRounds,
  type Standing,
  type TournamentMatch,
} from '../domain/models';

const text = copy.tournaments;
const columns = text.columns;
const numeric: (keyof Standing & keyof typeof columns)[] = [
  'played',
  'wins',
  'draws',
  'losses',
  'goalDifference',
  'points',
];

// Puan durumu: one row per accepted team, in the server's order.
export function StandingsView({ standings }: { standings: Standing[] }) {
  if (!standings.length) {
    return <Text style={styles.empty}>{text.standingsEmpty}</Text>;
  }
  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.head]}>
        <Text style={[styles.position, styles.headText]}>
          {columns.position}
        </Text>
        <Text style={[styles.team, styles.headText]}>{columns.team}</Text>
        {numeric.map(key => (
          <Text key={key} style={[styles.cell, styles.headText]}>
            {columns[key]}
          </Text>
        ))}
      </View>
      {standings.map(row => (
        <View
          key={row.entryId}
          accessible
          accessibilityLabel={text.standingLabel(
            row.position,
            row.teamName,
            row.played,
            row.points,
          )}
          style={[styles.row, styles.divider]}
        >
          <Text style={styles.position}>{row.position}</Text>
          <Text numberOfLines={1} style={styles.team}>
            {row.teamName}
          </Text>
          {numeric.map(key => (
            <Text
              key={key}
              style={[styles.cell, key === 'points' && styles.points]}
            >
              {key === 'goalDifference' && row[key] > 0
                ? '+' + row[key]
                : row[key]}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const score = (match: TournamentMatch) =>
  isPlayed(match) ? match.homeGoals + ' – ' + match.awayGoals : text.notPlayed;

// Fikstür: matches grouped by week. The organizer can open a match to edit.
export function FixtureView({
  matches,
  onOpen,
  disabled,
}: {
  matches: TournamentMatch[];
  onOpen?(match: TournamentMatch): void;
  disabled?: boolean;
}) {
  if (!matches.length) {
    return <Text style={styles.empty}>{text.fixtureEmpty}</Text>;
  }
  return (
    <View style={styles.rounds}>
      {matchRounds(matches).map(round => (
        <View key={round.round} style={styles.round}>
          <Text accessibilityRole="header" style={styles.week}>
            {text.week(round.round)}
          </Text>
          {round.matches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              disabled={disabled}
              onOpen={onOpen ? () => onOpen(match) : undefined}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function MatchCard({
  match,
  disabled,
  onOpen,
}: {
  match: TournamentMatch;
  disabled?: boolean;
  onOpen?(): void;
}) {
  const played = isPlayed(match);
  const body = (
    <>
      <View style={styles.matchBody}>
        <View style={styles.teams}>
          <Text numberOfLines={1} style={[styles.side, styles.home]}>
            {match.homeName}
          </Text>
          <Text style={[styles.score, !played && styles.scorePending]}>
            {played ? match.homeGoals + ' – ' + match.awayGoals : text.vs}
          </Text>
          <Text numberOfLines={1} style={styles.side}>
            {match.awayName}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <CalendarDays size={12} color={colors.muted} />
          <Text style={styles.meta}>
            {match.kickoffAt ? text.kickoff(match.kickoffAt) : text.noKickoff}
          </Text>
        </View>
        {match.venue ? (
          <View style={styles.metaRow}>
            <MapPin size={12} color={colors.muted} />
            <Text style={styles.meta}>{match.venue}</Text>
          </View>
        ) : null}
      </View>
      {onOpen ? <ChevronRight size={16} color={colors.muted} /> : null}
    </>
  );
  const label = text.matchLabel(match.homeName, match.awayName, score(match));
  if (!onOpen) {
    return (
      <View accessible accessibilityLabel={label} style={styles.match}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={text.editMatch}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onOpen}
      style={({ pressed }) => [styles.match, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    gap: space.xs,
  },
  head: { minHeight: 36, backgroundColor: colors.raised },
  headText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  divider: { borderTopWidth: 1, borderTopColor: colors.hairline },
  position: { width: 22, color: colors.secondary, fontSize: 12 },
  team: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  cell: {
    width: 26,
    textAlign: 'center',
    color: colors.secondary,
    fontSize: 12,
  },
  points: { color: colors.brand, fontWeight: '800' },
  rounds: { gap: space.lg },
  round: { gap: space.sm },
  week: { color: colors.text, fontSize: 15, fontWeight: '800' },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.raised },
  matchBody: { flex: 1, gap: space.xs },
  teams: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  side: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  home: { textAlign: 'right' },
  score: {
    minWidth: 52,
    textAlign: 'center',
    color: colors.brand,
    fontSize: 15,
    fontWeight: '800',
  },
  scorePending: { color: colors.muted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
