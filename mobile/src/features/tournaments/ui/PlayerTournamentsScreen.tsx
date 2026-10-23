import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CalendarDays, ChevronRight, Medal, Shield } from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { TopBar } from '../../../shared/ui/TopBar';
import { Screen } from '../../../shared/ui/Screen';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { TournamentsService } from '../application/tournaments-service';
import type { PlayerTournament } from '../domain/models';
import { StatusBadge } from './TournamentParts';

const text = copy.tournaments;

// Turnuvalarım (23 Oct 2026): tournaments the player plays in through a
// team roster, with the table position and the team's next match.
export function PlayerTournamentsScreen({
  token,
  service,
  onBack,
  onOpen,
  onBrowse,
}: {
  token: string;
  service: TournamentsService;
  onBack(): void;
  onOpen(id: string): void;
  onBrowse(): void;
}) {
  const [items, setItems] = useState<PlayerTournament[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    let current = true;
    setError('');
    service
      .playerTournaments(token)
      .then(value => current && setItems(value))
      .catch(
        failure =>
          current &&
          setError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          ),
      );
    return () => {
      current = false;
    };
  }, [service, token]);
  useFocusEffect(load);
  return (
    <Screen>
      <TopBar title={text.playerTitle} onBack={onBack} />
      {error && !items ? (
        <>
          <ErrorBanner message={error} />
          <Button label={copy.form.retry} onPress={() => load()} />
        </>
      ) : !items ? (
        <ActivityIndicator color={colors.brand} />
      ) : items.length ? (
        <View style={styles.list}>
          {items.map(item => {
            const next = item.nextMatch;
            const opponent = next
              ? next.homeEntryId === item.entryId
                ? next.awayName
                : next.homeName
              : '';
            return (
              <Pressable
                key={item.entryId}
                accessibilityRole="button"
                onPress={() => onOpen(item.tournament.id)}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.head}>
                  <Text style={styles.name} numberOfLines={2}>
                    {item.tournament.name}
                  </Text>
                  <StatusBadge status={item.tournament.status} league />
                </View>
                <View style={styles.line}>
                  <Shield size={15} color={colors.muted} />
                  <Text style={styles.meta}>{item.clubName}</Text>
                </View>
                {item.position > 0 ? (
                  <View style={styles.line}>
                    <Medal size={15} color={colors.brand} />
                    <Text style={styles.standing}>
                      {text.playerStanding(
                        item.position,
                        item.teams,
                        item.points,
                      )}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.line}>
                  <CalendarDays size={15} color={colors.muted} />
                  <Text style={styles.meta}>
                    {next
                      ? text.playerNext(
                          next.round,
                          opponent,
                          next.kickoffAt
                            ? text.kickoff(next.kickoffAt)
                            : text.noKickoff,
                        )
                      : text.playerNoNext}
                  </Text>
                  <ChevronRight size={16} color={colors.muted} />
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <>
          <EmptyState
            icon={Medal}
            title={text.playerEmptyTitle}
            body={text.playerEmptyBody}
          />
          <Button label={text.playerBrowse} secondary onPress={onBrowse} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  card: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.85 },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  name: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '800' },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  meta: { flex: 1, color: colors.secondary, fontSize: 13 },
  standing: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
});
