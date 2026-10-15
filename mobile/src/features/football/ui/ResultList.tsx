import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { Fixture } from '../domain/models';
import { groupResultsByDay } from '../domain/rules';
import { clock, matchDay } from './FootballStates';
import { RemoteLogo } from '../../../shared/ui/RemoteLogo';

const text = copy.footballData;

// Finished matches grouped by calendar day, newest first.
export function ResultList({ items }: { items: Fixture[] }) {
  return (
    <View style={styles.list}>
      {groupResultsByDay(items).map(day => (
        <View key={day.key} style={styles.day}>
          <Text style={styles.date}>{matchDay(day.kickoff)}</Text>
          <FixtureCard items={day.items} />
        </View>
      ))}
    </View>
  );
}

// Today's matches in kickoff order.
export function FixtureCard({ items }: { items: Fixture[] }) {
  return (
    <View style={styles.card}>
      {items.map((item, index) => (
        <FixtureRow key={item.id} fixture={item} divided={index > 0} />
      ))}
    </View>
  );
}

// Status text: live minute, "MS", the kickoff time, or the provider label.
export function fixtureStatus(fixture: Fixture) {
  if (fixture.status === 'live')
    return fixture.elapsed !== null
      ? text.minute(fixture.elapsed)
      : fixture.statusLabel;
  if (fixture.status === 'finished') return text.finished;
  if (fixture.status === 'scheduled') return clock(fixture.kickoff);
  return fixture.statusLabel;
}

function FixtureRow({
  fixture,
  divided,
}: {
  fixture: Fixture;
  divided: boolean;
}) {
  const live = fixture.status === 'live';
  const score =
    fixture.homeGoals !== null && fixture.awayGoals !== null
      ? fixture.homeGoals + ' - ' + fixture.awayGoals
      : '-';
  const status = fixtureStatus(fixture);
  return (
    <View
      style={[styles.row, divided && styles.divided]}
      accessible
      accessibilityLabel={[
        fixture.home.name,
        score,
        fixture.away.name,
        live ? text.live + ' ' + status : status,
        fixture.round,
      ]
        .filter(Boolean)
        .join(', ')}
    >
      <View style={styles.meta}>
        <Text numberOfLines={1} style={styles.round}>
          {fixture.round}
        </Text>
        <View style={styles.status}>
          {live ? (
            <View style={styles.liveBadge}>
              <Text style={styles.liveText}>{text.live}</Text>
            </View>
          ) : null}
          <Text style={[styles.statusText, live && styles.minute]}>
            {status}
          </Text>
        </View>
      </View>
      <View style={styles.teams}>
        <Side name={fixture.home.name} logo={fixture.home.logoUrl} />
        <Text style={styles.score}>{score}</Text>
        <Side name={fixture.away.name} logo={fixture.away.logoUrl} away />
      </View>
    </View>
  );
}

function Side({
  name,
  logo,
  away,
}: {
  name: string;
  logo: string;
  away?: boolean;
}) {
  return (
    <View style={[styles.side, away && styles.awaySide]}>
      <RemoteLogo uri={logo} name={name} size={26} />
      <Text
        numberOfLines={2}
        style={[styles.teamName, away && styles.awayName]}
      >
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
  day: { gap: space.sm },
  date: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  row: { padding: space.md, gap: space.sm },
  divided: { borderTopWidth: 1, borderTopColor: colors.border },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  round: { flex: 1, color: colors.muted, fontSize: 11 },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  statusText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  minute: { color: colors.danger },
  liveBadge: {
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  liveText: {
    color: colors.brandInk,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  teams: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  side: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  awaySide: { flexDirection: 'row-reverse' },
  teamName: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
  awayName: { textAlign: 'right' },
  score: {
    minWidth: 56,
    textAlign: 'center',
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
