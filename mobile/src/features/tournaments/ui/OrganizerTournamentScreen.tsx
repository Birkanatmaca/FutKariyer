import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '../../connections';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import type { TournamentsService } from '../application/tournaments-service';
import { errorMessage } from '../application/validation';
import {
  canManagePlay,
  isPlayed,
  statusTransitions,
  type EntryDecision,
  type FixtureLegs,
  type Tournament,
  type TournamentEntry,
  type TournamentMatch,
  type TournamentStatus,
  type TournamentTable,
} from '../domain/models';
import { InviteTeamsPanel } from './InviteTeamsPanel';
import { MatchEditor } from './MatchEditor';
import { TournamentSummary } from './TournamentDetailScreen';
import { EntryCard, Segments, type EntryAction } from './TournamentParts';
import { FixtureView, StandingsView } from './TournamentTableViews';

const text = copy.tournaments;
type ManageTab = 'entries' | 'fixture' | 'standings';
const manageTabs: { key: ManageTab; label: string }[] = [
  { key: 'entries', label: text.manageTabs.entries },
  { key: 'fixture', label: text.manageTabs.fixture },
  { key: 'standings', label: text.manageTabs.standings },
];
// The match being edited, or a new match ('new').
type Editing = TournamentMatch | 'new' | null;

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
      const [table, entries] = await Promise.all([
        service.organizerTable(token, id),
        service.entries(token, id),
      ]);
      return { tournament: table.tournament, table, entries };
    }, [service, token, id]),
  );
  const [tab, setTab] = useState<ManageTab>('entries');
  const [editing, setEditing] = useState<Editing>(null);
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

  async function generate(legs: FixtureLegs) {
    await run('fixture', async () => {
      await service.generateFixture(token, id, legs);
      return text.generated;
    });
  }

  async function clearFixture() {
    if (
      busy ||
      !(await confirmAction(text.clearTitle, text.clearBody, text.clearFixture))
    )
      return;
    await run('clear', async () => {
      await service.clearFixture(token, id);
      return text.cleared;
    });
  }

  async function cancelInvite(entry: TournamentEntry) {
    if (
      busy ||
      !(await confirmAction(
        text.cancelInviteTitle,
        text.cancelInviteBody(entry.clubName),
        text.cancelInvite,
      ))
    )
      return;
    await run(entry.id, async () => {
      await service.cancelInvite(token, id, entry.id);
      return text.inviteCancelled(entry.clubName);
    });
  }

  function entryActions(entry: TournamentEntry): EntryAction[] {
    if (!decidable) return [];
    if (entry.status === 'pending') {
      return [
        { label: text.accept, onPress: () => decide(entry, 'accept') },
        {
          label: text.reject,
          danger: true,
          onPress: () => decide(entry, 'reject'),
        },
      ];
    }
    if (entry.status === 'invited') {
      return [
        {
          label: text.cancelInvite,
          danger: true,
          onPress: () => cancelInvite(entry),
        },
      ];
    }
    return [];
  }

  function fixture(table: TournamentTable) {
    if (editing) {
      return (
        <MatchEditor
          token={token}
          tournamentId={id}
          service={service}
          teams={table.teams}
          match={editing === 'new' ? null : editing}
          round={Math.max(1, ...table.matches.map(match => match.round))}
          onDone={message => {
            setEditing(null);
            setError('');
            setNotice(message);
            state.retry();
          }}
          onCancel={() => setEditing(null)}
        />
      );
    }
    const enoughTeams = table.teams.length >= 2;
    const unplayed = table.matches.some(match => !isPlayed(match));
    return (
      <>
        {!decidable ? (
          <Text style={styles.meta}>{text.playLocked}</Text>
        ) : (
          <>
            {!table.matches.length ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{text.generateTitle}</Text>
                <Text style={styles.meta}>
                  {enoughTeams ? text.generateHelp : text.generateNeedsTeams}
                </Text>
                {([1, 2] as const).map(legs => (
                  <Button
                    key={legs}
                    label={text.legs[legs]}
                    secondary={legs === 2}
                    loading={busy === 'fixture'}
                    disabled={!!busy || !enoughTeams}
                    onPress={() => generate(legs)}
                  />
                ))}
              </View>
            ) : null}
            <Button
              label={text.addMatch}
              secondary
              disabled={!!busy || !enoughTeams}
              onPress={() => {
                setNotice('');
                setEditing('new');
              }}
            />
            {unplayed ? (
              <Button
                label={text.clearFixture}
                secondary
                loading={busy === 'clear'}
                disabled={!!busy}
                onPress={clearFixture}
              />
            ) : null}
            {table.matches.length ? (
              <Text style={styles.meta}>{text.matchHint}</Text>
            ) : null}
          </>
        )}
        <FixtureView
          matches={table.matches}
          disabled={!!busy}
          onOpen={
            decidable
              ? match => {
                  setNotice('');
                  setEditing(match);
                }
              : undefined
          }
        />
      </>
    );
  }

  const tournament = state.data?.tournament;
  const decidable = !!tournament && canManagePlay(tournament);
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
          <Segments<ManageTab>
            options={manageTabs}
            value={tab}
            onChange={key => {
              setTab(key);
              setEditing(null);
            }}
          />
          {tab === 'fixture' && state.data ? (
            fixture(state.data.table)
          ) : tab === 'standings' && state.data ? (
            <StandingsView standings={state.data.table.standings} />
          ) : (
            <>
              <Text accessibilityRole="header" style={styles.section}>
                {text.entriesSection}
              </Text>
              <Text style={styles.meta}>
                {text.teams(tournament.acceptedTeams, tournament.teamCapacity)}{' '}
                · {text.pending(tournament.pendingEntries)}
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
                      actions={entryActions(entry)}
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.meta}>{text.organizerEntriesEmpty}</Text>
              )}
              {decidable ? (
                <InviteTeamsPanel
                  token={token}
                  tournamentId={id}
                  service={service}
                  onInvited={message => {
                    setError('');
                    setNotice(message);
                    state.retry();
                  }}
                />
              ) : null}
            </>
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
  card: {
    padding: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
