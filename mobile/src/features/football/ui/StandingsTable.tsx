import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { StandingRow } from '../domain/models';
import {
  formResults,
  groupStandings,
  standingDescriptions,
  standingNote,
  type FormResult,
} from '../domain/rules';
import { RemoteLogo } from '../../../shared/ui/RemoteLogo';

const text = copy.footballData;
const table = text.table;
const markers = [
  colors.brand,
  colors.info,
  colors.accent,
  colors.warning,
  colors.danger,
  colors.secondary,
];
const formColors: Record<FormResult, string> = {
  W: colors.success,
  D: colors.warning,
  L: colors.danger,
};
// Known provider notes are shown in Turkish; unknown ones as they are.
export function standingNoteLabel(description: string) {
  const note = standingNote(description);
  return note ? text.notes[note] : description;
}
// A/Y columns need room; narrow phones keep the compact column set.
const wideWindow = 400;

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  const { width } = useWindowDimensions();
  const wide = width >= wideWindow;
  // Notes with the same Turkish label (e.g. seeded and unseeded play-off
  // places) share one colour and one legend entry.
  const labels = standingDescriptions(rows)
    .map(standingNoteLabel)
    .filter((label, index, all) => all.indexOf(label) === index);
  const marker = (row: StandingRow) =>
    row.description
      ? markers[
          labels.indexOf(standingNoteLabel(row.description)) % markers.length
        ]
      : colors.transparent;
  return (
    <View style={styles.wrap}>
      {groupStandings(rows).map(group => (
        <View key={group.name || 'all'} style={styles.group}>
          {group.name ? (
            <Text accessibilityRole="header" style={styles.groupTitle}>
              {group.name}
            </Text>
          ) : null}
          <View style={styles.table}>
            <View style={[styles.row, styles.head]}>
              <View style={styles.marker} />
              <View style={styles.rankCell}>
                <Text style={[styles.rank, styles.headText]}>{table.rank}</Text>
              </View>
              <Text style={[styles.team, styles.headText]}>{table.team}</Text>
              <Num value={table.played} head />
              <Num value={table.won} head />
              <Num value={table.drawn} head />
              <Num value={table.lost} head />
              {wide ? <Num value={table.goalsFor} head /> : null}
              {wide ? <Num value={table.goalsAgainst} head /> : null}
              <Num value={table.goalDiff} head wide />
              <Num value={table.points} head strong />
            </View>
            {group.rows.map(row => (
              <Row
                key={group.name + row.rank + row.team.name}
                row={row}
                wide={wide}
                marker={marker(row)}
              />
            ))}
          </View>
        </View>
      ))}
      {labels.length ? (
        <View style={styles.legend} accessibilityLabel={text.legend}>
          {labels.map((label, index) => (
            <View key={label} style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: markers[index % markers.length] },
                ]}
              />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Row({
  row,
  wide,
  marker,
}: {
  row: StandingRow;
  wide: boolean;
  marker: string;
}) {
  const form = formResults(row.form);
  const leader = row.rank === 1;
  return (
    <View style={[styles.row, leader && styles.leaderRow]}>
      <View style={[styles.marker, { backgroundColor: marker }]} />
      <View style={styles.rankCell}>
        <Text style={[styles.rank, leader && styles.leaderRank]}>
          {row.rank}
        </Text>
      </View>
      <View style={styles.team}>
        <View style={styles.teamLine}>
          <RemoteLogo uri={row.team.logoUrl} name={row.team.name} size={20} />
          <Text
            numberOfLines={1}
            style={[styles.teamName, leader && styles.leaderName]}
          >
            {row.team.name}
          </Text>
        </View>
        {form.length ? <FormStrip form={form} /> : null}
      </View>
      <Num value={row.played} />
      <Num value={row.won} />
      <Num value={row.drawn} />
      <Num value={row.lost} />
      {wide ? <Num value={row.goalsFor} /> : null}
      {wide ? <Num value={row.goalsAgainst} /> : null}
      <Num value={row.goalDiff > 0 ? '+' + row.goalDiff : row.goalDiff} wide />
      <Num value={row.points} strong leader={leader} />
    </View>
  );
}

function FormStrip({ form }: { form: FormResult[] }) {
  return (
    <View
      style={styles.form}
      accessible
      accessibilityLabel={
        text.formLabel +
        ': ' +
        form.map(item => text.formResult[item]).join(', ')
      }
    >
      {form.map((item, index) => (
        <View
          key={index}
          style={[styles.formChip, { backgroundColor: formColors[item] }]}
        >
          <Text style={styles.formText}>{text.form[item]}</Text>
        </View>
      ))}
    </View>
  );
}

function Num({
  value,
  head,
  strong,
  leader,
  wide,
}: {
  value: string | number;
  head?: boolean;
  strong?: boolean;
  leader?: boolean;
  wide?: boolean;
}) {
  return (
    <Text
      style={[
        styles.num,
        wide && styles.wideNum,
        strong && styles.points,
        head && styles.headText,
        strong && !head && styles.pointsValue,
        leader && styles.leaderPoints,
      ]}
    >
      {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  group: { gap: space.sm },
  groupTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  table: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    overflow: 'hidden',
  },
  leaderRow: { backgroundColor: colors.brandWash },
  rankCell: { width: 26, alignItems: 'center' },
  leaderRank: {
    width: 22,
    height: 22,
    lineHeight: 22,
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: colors.brand,
    color: colors.brandInk,
    fontWeight: '800',
  },
  leaderName: { fontWeight: '800' },
  leaderPoints: { color: colors.brand },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingRight: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  head: { minHeight: 34, borderTopWidth: 0, backgroundColor: colors.raised },
  headText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  marker: { width: 3, alignSelf: 'stretch', marginRight: space.xs },
  rank: {
    width: 22,
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  team: { flex: 1, minWidth: 0, paddingVertical: 6, gap: 3, paddingLeft: 4 },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamName: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  num: {
    width: 22,
    color: colors.secondary,
    fontSize: 12,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  points: { width: 30 },
  wideNum: { width: 30 },
  pointsValue: { color: colors.text, fontWeight: '800', fontSize: 14 },
  form: { flexDirection: 'row', gap: 2, paddingLeft: 24 },
  formChip: {
    width: 14,
    height: 14,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formText: { color: colors.brandInk, fontSize: 9, fontWeight: '800' },
  legend: { gap: space.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  legendDot: { width: 8, height: 8, borderRadius: radius.pill },
  legendText: {
    flex: 1,
    color: colors.secondary,
    fontSize: 11,
    lineHeight: 16,
  },
});
