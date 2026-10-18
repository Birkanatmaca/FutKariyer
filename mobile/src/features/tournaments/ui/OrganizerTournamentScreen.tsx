import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '../../connections';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, space } from '../../../styles/tokens';
import type { TournamentsService } from '../application/tournaments-service';
import { errorMessage } from '../application/validation';
import {
  statusTransitions,
  type EntryDecision,
  type Tournament,
  type TournamentEntry,
  type TournamentStatus,
} from '../domain/models';
import { TournamentSummary } from './TournamentDetailScreen';
import { EntryCard } from './TournamentParts';

const text = copy.tournaments;

// Final states ask for confirmation before the change is sent.
async function confirmStatus(tournament: Tournament, status: TournamentStatus) {
  if (status === 'finished') {
    return confirmAction(
      text.finishTitle,
      text.finishBody(tournament.name),
      text.statusActions.finished,
    );
  }
  if (status === 'cancelled') {
    return confirmAction(
      text.cancelTitle,
      text.cancelBody(tournament.name),
      text.statusActions.cancelled,
    );
  }
  return true;
}

export function OrganizerTournamentScreen({
  token,
  id,
  service,
  onBack,
}: {
  token: string;
  id: string;
  service: TournamentsService;
  onBack(): void;
}) {
  const state = useFocusedResource(
    useCallback(async () => {
      const [mine, entries] = await Promise.all([
        service.mine(token),
        service.entries(token, id),
      ]);
      return { tournament: mine.find(item => item.id === id) ?? null, entries };
    }, [service, token, id]),
  );
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function run(key: string, action: () => Promise<string>) {
    if (busy) return;
    setBusy(key);
    setNotice('');
    setError('');
    try {
      setNotice(await action());
      state.retry();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy('');
    }
  }

  async function changeStatus(
    tournament: Tournament,
    status: TournamentStatus,
  ) {
    if (busy || !(await confirmStatus(tournament, status))) return;
    await run('status', async () => {
      await service.setStatus(token, tournament.id, status);
      return text.statusChanged(text.status[status]);
    });
  }

  async function decide(entry: TournamentEntry, decision: EntryDecision) {
    if (busy) return;
    if (
      decision === 'reject' &&
      !(await confirmAction(
        text.rejectTitle,
        text.rejectBody(entry.clubName),
        text.reject,
      ))
    )
      return;
    await run(entry.id, async () => {
      await service.decide(token, id, entry.id, decision);
      return decision === 'accept'
        ? text.acceptedEntry(entry.clubName)
        : text.rejectedEntry(entry.clubName);
    });
  }

  const tournament = state.data?.tournament;
  const decidable =
    tournament?.status === 'open' || tournament?.status === 'closed';
  return (
    <Screen>
      <TopBar title={text.manageTitle} onBack={onBack} />
      {state.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} onPress={state.retry} />
        </>
      ) : !tournament ? (
        <ErrorBanner message={text.notFound} />
      ) : (
        <>
          <TournamentSummary tournament={tournament} showOrganizer={false} />
          {notice ? (
            <Text accessibilityRole="alert" style={styles.notice}>
              {notice}
            </Text>
          ) : null}
          <ErrorBanner message={error} />
          {statusTransitions[tournament.status].map(status => (
            <Button
              key={status}
              label={text.statusActions[status]}
              secondary
              loading={busy === 'status'}
              disabled={!!busy}
              onPress={() => changeStatus(tournament, status)}
            />
          ))}
          <Text accessibilityRole="header" style={styles.section}>
            {text.entriesSection}
          </Text>
          <Text style={styles.meta}>
            {text.teams(tournament.acceptedTeams, tournament.teamCapacity)} ·{' '}
            {text.pending(tournament.pendingEntries)}
          </Text>
          {state.data?.entries.length ? (
            <View style={styles.list}>
              {state.data.entries.map(entry => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  title={entry.clubName}
                  subtitle={
                    (entry.clubDistrict || text.noDistrict) +
                    (entry.clubFootballType !== 'unknown'
                      ? ' · ' + copy.football.types[entry.clubFootballType]
                      : '')
                  }
                  busy={busy === entry.id}
                  disabled={!!busy}
                  actions={
                    decidable && entry.status === 'pending'
                      ? [
                          {
                            label: text.accept,
                            onPress: () => decide(entry, 'accept'),
                          },
                          {
                            label: text.reject,
                            danger: true,
                            onPress: () => decide(entry, 'reject'),
                          },
                        ]
                      : []
                  }
                />
              ))}
            </View>
          ) : (
            <Text style={styles.meta}>{text.organizerEntriesEmpty}</Text>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { color: colors.success, fontSize: 13, lineHeight: 19 },
  section: { color: colors.text, fontSize: 18, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  list: { gap: space.md },
});
