import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, ChevronRight, Trophy } from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { TournamentsService } from '../application/tournaments-service';
import type { PlayerTournament } from '../domain/models';
import { StatusBadge } from './TournamentParts';

const text = copy.tournaments;

// Club home card (23 Oct 2026): the club's running tournament with its table
// position and next match. A halı saha club without one is invited to the
// halı saha leagues instead of the TFF link card.
export function TeamTournamentCard({
  token,
  service,
  invite,
  onOpen,
  onBrowse,
}: {
  token: string;
  service: TournamentsService;
  // Show the join card when the club plays in no tournament.
  invite: boolean;
  onOpen(id: string): void;
  onBrowse(): void;
}) {
  const [items, setItems] = useState<PlayerTournament[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      let current = true;
      service
        .playerTournaments(token)
        .then(value => current && setItems(value))
        .catch(() => current && setItems([]));
      return () => {
        current = false;
      };
    }, [service, token]),
  );
  if (!items) return null;
  const item =
    items.find(entry => entry.tournament.status !== 'finished') ?? null;
  if (!item) {
    if (!invite) return null;
    return (
      <View style={styles.card}>
        <View style={styles.icon}>
          <Trophy size={20} color={colors.brand} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {text.clubCardJoinTitle}
        </Text>
        <Text style={styles.body}>{text.clubCardJoinBody}</Text>
        <Button label={text.clubCardBrowse} compact onPress={onBrowse} />
      </View>
    );
  }
  const next = item.nextMatch;
  const opponent = next
    ? next.homeEntryId === item.entryId
      ? next.awayName
      : next.homeName
    : '';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpen(item.tournament.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <View style={styles.icon}>
          <Trophy size={20} color={colors.brand} />
        </View>
        <View style={styles.headText}>
          <Text style={styles.eyebrow}>{text.clubCardEyebrow}</Text>
          <Text
            accessibilityRole="header"
            style={styles.title}
            numberOfLines={2}
          >
            {item.tournament.name}
          </Text>
        </View>
        <StatusBadge status={item.tournament.status} league />
      </View>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {item.position > 0 ? item.position + '.' : '–'}
          </Text>
          <Text style={styles.statLabel}>{text.clubCardPosition}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{item.points}</Text>
          <Text style={styles.statLabel}>{text.clubCardPoints}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{item.teams}</Text>
          <Text style={styles.statLabel}>{text.clubCardTeams}</Text>
        </View>
      </View>
      <View style={styles.line}>
        <CalendarDays size={15} color={colors.muted} />
        <Text style={styles.next}>
          {next
            ? text.playerNext(
                next.round,
                opponent,
                next.kickoffAt ? text.kickoff(next.kickoffAt) : text.noKickoff,
              )
            : text.playerNoNext}
        </Text>
        <ChevronRight size={16} color={colors.muted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.85 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headText: { flex: 1, gap: 2 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandWash,
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: { ...type.headline, color: colors.text },
  body: { ...type.body, color: colors.secondary, marginBottom: space.xs },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 11 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  next: { flex: 1, color: colors.secondary, fontSize: 13 },
});
