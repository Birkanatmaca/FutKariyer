import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { TopPlayer } from '../domain/models';
import { RemoteLogo } from '../../../shared/ui/RemoteLogo';

const text = copy.footballData;

export function TopPlayersList({
  title,
  unit,
  players,
}: {
  title: string;
  unit: string;
  players: TopPlayer[];
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      {players.length ? (
        <View style={styles.card}>
          {players.map((player, index) => (
            <View
              key={player.rank + player.name}
              style={[styles.row, index > 0 && styles.divider]}
              accessible
              accessibilityLabel={[
                player.rank + '.',
                player.name,
                player.team.name,
                player.value + ' ' + unit,
                text.appearances(player.appearances),
              ].join(', ')}
            >
              <Text style={styles.rank}>{player.rank}</Text>
              <RemoteLogo
                uri={player.photoUrl}
                name={player.name}
                size={36}
                round
              />
              <View style={styles.info}>
                <Text numberOfLines={1} style={styles.name}>
                  {player.name}
                </Text>
                <View style={styles.teamLine}>
                  <RemoteLogo
                    uri={player.team.logoUrl}
                    name={player.team.name}
                    size={14}
                  />
                  <Text numberOfLines={1} style={styles.team}>
                    {player.team.name}
                  </Text>
                </View>
              </View>
              <View style={styles.value}>
                <Text style={styles.valueText}>{player.value}</Text>
                <Text style={styles.apps}>
                  {text.appearances(player.appearances)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>{text.statsEmpty}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  heading: { color: colors.text, fontSize: 15, fontWeight: '800' },
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 56,
    paddingVertical: space.sm,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rank: {
    width: 20,
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  info: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: colors.text, fontSize: 13, fontWeight: '700' },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  team: { flex: 1, color: colors.secondary, fontSize: 11 },
  value: { alignItems: 'flex-end', minWidth: 48 },
  valueText: {
    color: colors.brand,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  apps: { color: colors.muted, fontSize: 10 },
  empty: { color: colors.secondary, fontSize: 12 },
});
