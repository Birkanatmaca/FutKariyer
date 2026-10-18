import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, MapPin, Medal } from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import type { FootballType } from '../../../shared/domain/football';
import { colors, radius, space } from '../../../styles/tokens';
import type { TournamentsService } from '../application/tournaments-service';
import {
  canEnterTournament,
  isEligibleClub,
  type ClubEntrySource,
  type Tournament,
  type TournamentEntry,
} from '../domain/models';
import { TournamentEntryForm } from './TournamentEntryForm';
import {
  StatusBadge,
  eligibleLabel,
  formatDay,
  tournamentDates,
} from './TournamentParts';

const text = copy.tournaments;

export function TournamentDetailScreen({
  token,
  id,
  service,
  club,
  onBack,
  onEntries,
}: {
  token: string;
  id: string;
  service: TournamentsService;
  // Only club accounts can enter; players and coaches browse.
  club?: ClubEntrySource;
  onBack(): void;
  onEntries?(): void;
}) {
  const state = useFocusedResource(
    useCallback(() => service.detail(token, id), [service, token, id]),
  );
  const tournament = state.data;
  return (
    <Screen>
      <TopBar title={text.title} onBack={onBack} backLabel={text.detailBack} />
      {state.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} onPress={state.retry} />
        </>
      ) : tournament ? (
        <>
          <TournamentSummary tournament={tournament} showOrganizer />
          {club ? (
            <ClubEntryPanel
              token={token}
              tournament={tournament}
              service={service}
              club={club}
              onEntries={onEntries}
            />
          ) : (
            <Text style={styles.help}>{text.browseOnly}</Text>
          )}
        </>
      ) : null}
    </Screen>
  );
}

export function TournamentSummary({
  tournament,
  showOrganizer,
}: {
  tournament: Tournament;
  showOrganizer: boolean;
}) {
  return (
    <>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Medal size={26} color={colors.brand} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {tournament.name}
        </Text>
        {showOrganizer ? (
          <Text style={styles.organizer}>
            {text.organizer(tournament.organizerName)}
          </Text>
        ) : null}
        <StatusBadge status={tournament.status} />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{text.scheduleTitle}</Text>
        <View style={styles.metaRow}>
          <CalendarDays size={14} color={colors.secondary} />
          <Text style={styles.body}>{tournamentDates(tournament)}</Text>
        </View>
        <Text style={styles.meta}>
          {text.deadline(formatDay(tournament.applicationDeadline))}
        </Text>
        <View style={styles.metaRow}>
          <MapPin size={14} color={colors.secondary} />
          <Text style={styles.body}>
            {(tournament.venue || text.noVenue) +
              ' · ' +
              (tournament.district || text.noDistrict)}
          </Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{text.formatTitle}</Text>
        <Text style={styles.highlight}>{text.formats[tournament.format]}</Text>
        <Text style={styles.meta}>
          {text.eligible} · {eligibleLabel(tournament)}
        </Text>
        <Text style={styles.meta}>
          {text.teams(tournament.acceptedTeams, tournament.teamCapacity)}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{text.about}</Text>
        <Text style={styles.body}>
          {tournament.description || text.noDescription}
        </Text>
      </View>
    </>
  );
}

type ClubState = { clubType: FootballType; entry: TournamentEntry | null };

function ClubEntryPanel({
  token,
  tournament,
  service,
  club,
  onEntries,
}: {
  token: string;
  tournament: Tournament;
  service: TournamentsService;
  club: ClubEntrySource;
  onEntries?(): void;
}) {
  const state = useFocusedResource(
    useCallback(async (): Promise<ClubState> => {
      const [clubType, entries] = await Promise.all([
        club.footballType(token),
        service.myEntries(token),
      ]);
      const entry =
        entries.find(item => item.tournamentId === tournament.id) ?? null;
      return { clubType, entry };
    }, [club, service, token, tournament.id]),
  );
  const [composing, setComposing] = useState(false);
  const [submitted, setSubmitted] = useState<TournamentEntry | null>(null);
  const [blocked, setBlocked] = useState('');

  if (state.loading) return <ActivityIndicator color={colors.brand} />;
  if (state.error || !state.data) {
    return (
      <>
        <ErrorBanner message={state.error} />
        <Button label={copy.form.retry} secondary onPress={state.retry} />
      </>
    );
  }
  const { clubType } = state.data;
  const entry = submitted ?? state.data.entry;
  if (entry && entry.status !== 'withdrawn') {
    return (
      <View style={styles.done}>
        <Text style={styles.cardTitle}>{text.entryStatusTitle}</Text>
        <View style={styles.row}>
          <StatusBadge status={entry.status} />
        </View>
        {submitted ? (
          <Text accessibilityRole="alert" style={styles.success}>
            {text.submitted}
          </Text>
        ) : null}
        <Text style={styles.help}>
          {entry.status === 'rejected'
            ? text.rejectedNote
            : text.activeEntryNote}
        </Text>
        {onEntries && entry.status !== 'rejected' ? (
          <Button label={text.entriesTitle} secondary onPress={onEntries} />
        ) : null}
      </View>
    );
  }
  const allowed = canEnterTournament(tournament, clubType, entry) && !blocked;
  const reason = blocked
    ? blocked
    : tournament.status !== 'open'
    ? text.notOpen
    : clubType === 'unknown'
    ? text.unknownType
    : !isEligibleClub(tournament, clubType)
    ? text.notEligible
    : '';
  if (composing && allowed) {
    return (
      <TournamentEntryForm
        token={token}
        tournamentId={tournament.id}
        service={service}
        loadSquad={club.squad}
        onSubmitted={value => {
          setComposing(false);
          setSubmitted(value);
        }}
        onCancel={(final, message) => {
          setComposing(false);
          if (final) setBlocked(message);
        }}
      />
    );
  }
  return (
    <View style={styles.apply}>
      <Text style={styles.help}>{text.applyHelp}</Text>
      {entry?.status === 'withdrawn' ? (
        <Text style={styles.help}>{text.withdrawnNote}</Text>
      ) : null}
      <Button
        label={text.apply}
        disabled={!allowed}
        onPress={() => setComposing(true)}
      />
      {reason ? (
        <Text accessibilityRole="alert" style={styles.reason}>
          {reason}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  organizer: { color: colors.secondary, fontSize: 15, fontWeight: '700' },
  card: {
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  body: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 21,
    flexShrink: 1,
  },
  highlight: { color: colors.brand, fontSize: 15, fontWeight: '700' },
  apply: { gap: space.md },
  help: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  reason: { color: colors.warning, fontSize: 13, lineHeight: 19 },
  done: {
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  row: { flexDirection: 'row' },
  success: { color: colors.success, fontSize: 14, fontWeight: '700' },
});
