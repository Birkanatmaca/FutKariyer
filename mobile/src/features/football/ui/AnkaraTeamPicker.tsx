import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { FootballService } from '../application/football-service';
import { useAnkaraLeagues } from '../application/useAnkaraLeagues';
import type { AnkaraOption, AnkaraQuery } from '../domain/models';
import { AnkaraPickers } from './AnkaraStandingsTab';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './FootballStates';

export type AnkaraTeamChoice = AnkaraQuery & { team: string };

const selectedId = (options: AnkaraOption[]) =>
  options.find(option => option.selected)?.id ?? '';

// Season → league → group, then one team from that group's table. A club
// links its own team with it (20 Oct 2026); the ids sent back are the page's
// own selection, so they always match the table the team was picked from.
export function AnkaraTeamPicker({
  service,
  token,
  initial,
  busy,
  onPick,
}: {
  service: FootballService;
  token: string;
  initial?: AnkaraTeamChoice;
  busy: boolean;
  onPick(choice: AnkaraTeamChoice): void;
}) {
  const text = copy.clubProfile;
  const leagues = useAnkaraLeagues(service, token, true, initial);
  const [team, setTeam] = useState(initial?.team ?? '');
  const { data } = leagues;
  const rows = data?.standings ?? [];
  // A team from another group is not a choice once the group changes.
  const chosen =
    !leagues.loading && rows.some(row => row.team.name === team) ? team : '';
  return (
    <View style={styles.stack}>
      {data ? (
        <AnkaraPickers
          data={data}
          query={leagues.query}
          loading={leagues.loading}
          select={leagues.select}
        />
      ) : null}
      {leagues.loading && !data ? (
        <LoadingBlock />
      ) : leagues.error ? (
        <ErrorBlock error={leagues.error} onRetry={leagues.retry} />
      ) : data ? (
        <>
          <Text accessibilityRole="header" style={styles.title}>
            {text.tffTeamsTitle}
          </Text>
          {rows.length ? (
            <View accessibilityRole="radiogroup" style={styles.list}>
              {rows.map(row => {
                const active = row.team.name === chosen;
                return (
                  <Pressable
                    key={row.rank + row.team.name}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active, disabled: busy }}
                    accessibilityLabel={row.team.name}
                    disabled={busy || leagues.loading}
                    onPress={() => setTeam(row.team.name)}
                    style={({ pressed }) => [
                      styles.row,
                      active && styles.rowActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.rank}>{row.rank}</Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.name, active && styles.nameActive]}
                    >
                      {row.team.name}
                    </Text>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active ? (
                        <Check size={14} color={colors.brandInk} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <EmptyBlock body={text.tffTeamsEmpty} />
          )}
          <Button
            label={text.tffConfirm}
            compact
            loading={busy}
            disabled={!chosen || leagues.loading}
            onPress={() =>
              onPick({
                season: selectedId(data.seasons),
                league: selectedId(data.leagues),
                group: selectedId(data.groups),
                team: chosen,
              })
            }
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  title: { ...type.headline, color: colors.text },
  list: { gap: space.xs },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  rowActive: { borderColor: colors.brand, backgroundColor: colors.brandWash },
  pressed: { opacity: 0.75 },
  rank: {
    ...type.caption,
    ...type.number,
    width: 22,
    color: colors.muted,
    fontWeight: '700',
  },
  name: { ...type.body, flex: 1, color: colors.secondary, fontWeight: '600' },
  nameActive: { color: colors.text },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.brand, backgroundColor: colors.brand },
});
