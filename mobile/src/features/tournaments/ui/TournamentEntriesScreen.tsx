import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Medal } from 'lucide-react-native';
import { confirmAction } from '../../connections';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { TopBar } from '../../../shared/ui/TopBar';
import { Screen } from '../../../shared/ui/Screen';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, space } from '../../../styles/tokens';
import type { TournamentsService } from '../application/tournaments-service';
import { errorMessage } from '../application/validation';
import type { ClubEntrySource, TournamentEntry } from '../domain/models';
import { TournamentEntryForm } from './TournamentEntryForm';
import { EntryCard, type EntryAction } from './TournamentParts';

const text = copy.tournaments;

export function TournamentEntriesScreen({
  token,
  service,
  club,
  onBack,
  onOpen,
}: {
  token: string;
  service: TournamentsService;
  // The club's squad, used to pick the roster when accepting an invitation.
  club?: ClubEntrySource;
  onBack(): void;
  onOpen(tournamentId: string): void;
}) {
  const state = useFocusedResource(
    useCallback(() => service.myEntries(token), [service, token]),
  );
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState<TournamentEntry | null>(null);

  async function decline(entry: TournamentEntry) {
    if (busyId) return;
    const confirmed = await confirmAction(
      text.declineInviteTitle,
      text.declineInviteBody(entry.tournamentName),
      text.declineInvite,
    );
    if (!confirmed) return;
    setBusyId(entry.id);
    setNotice('');
    setError('');
    try {
      await service.respond(token, entry.id, 'decline');
      setNotice(text.inviteDeclined);
      state.retry();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusyId('');
    }
  }

  async function withdraw(entry: TournamentEntry) {
    if (busyId) return;
    const confirmed = await confirmAction(
      text.withdrawTitle,
      text.withdrawBody(entry.tournamentName),
      text.withdraw,
    );
    if (!confirmed) return;
    setBusyId(entry.id);
    setNotice('');
    setError('');
    try {
      await service.withdraw(token, entry.id);
      setNotice(text.withdrawn);
      state.retry();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusyId('');
    }
  }

  function actions(entry: TournamentEntry): EntryAction[] {
    const list: EntryAction[] = [];
    // A cancelled tournament can no longer be opened from the public detail.
    if (entry.tournamentStatus !== 'cancelled') {
      list.push({
        label: text.open,
        onPress: () => onOpen(entry.tournamentId),
      });
    }
    if (entry.status === 'invited') {
      if (club) {
        list.push({
          label: text.acceptInvite,
          onPress: () => {
            setNotice('');
            setError('');
            setAccepting(entry);
          },
        });
      }
      list.push({
        label: text.declineInvite,
        danger: true,
        onPress: () => decline(entry),
      });
    }
    if (entry.status === 'pending' || entry.status === 'accepted') {
      list.push({
        label: text.withdraw,
        danger: true,
        onPress: () => withdraw(entry),
      });
    }
    return list;
  }

  return (
    <Screen>
      <TopBar title={text.entriesTitle} onBack={onBack} />
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      <ErrorBanner message={error} />
      {accepting && club ? (
        <TournamentEntryForm
          token={token}
          tournamentId={accepting.tournamentId}
          service={service}
          loadSquad={club.squad}
          title={text.acceptInviteTitle + ' · ' + accepting.tournamentName}
          submitLabel={text.acceptInviteSubmit}
          sendingLabel={text.acceptInviteSending}
          withMessage={false}
          send={input =>
            service.respond(token, accepting.id, 'accept', input.playerIds)
          }
          onSubmitted={() => {
            setNotice(text.inviteAccepted(accepting.tournamentName));
            setAccepting(null);
            state.retry();
          }}
          onCancel={(final, message) => {
            setAccepting(null);
            if (final) {
              setError(message);
              state.retry();
            }
          }}
        />
      ) : state.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} secondary onPress={state.retry} />
        </>
      ) : state.data?.length ? (
        <View style={styles.list}>
          {state.data.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              title={entry.tournamentName}
              subtitle={text.status[entry.tournamentStatus]}
              busy={busyId === entry.id}
              disabled={!!busyId}
              actions={actions(entry)}
            />
          ))}
        </View>
      ) : state.data ? (
        <EmptyState
          icon={Medal}
          title={text.entriesEmptyTitle}
          body={text.entriesEmptyBody}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { color: colors.success, fontSize: 13, lineHeight: 19 },
  list: { gap: space.md },
});
