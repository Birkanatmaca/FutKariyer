import React, { useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '../../connections';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Field } from '../../../shared/ui/Field';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { TournamentsService } from '../application/tournaments-service';
import {
  emptyMatchDraft,
  errorMessage,
  matchDraftOf,
  matchFieldErrors,
  toMatchInput,
  validateMatch,
  type MatchDraft,
  type MatchErrors,
} from '../application/validation';
import {
  tournamentLimits,
  type TournamentMatch,
  type TournamentTeam,
} from '../domain/models';
import { Chip } from './TournamentParts';

const text = copy.tournaments;
const labels = text.matchFields;

// Adds a match or edits one: week, the two accepted teams, kickoff, venue
// and, once played, the score (both goals or neither).
export function MatchEditor({
  token,
  tournamentId,
  service,
  teams,
  match,
  round,
  onDone,
  onCancel,
}: {
  token: string;
  tournamentId: string;
  service: TournamentsService;
  teams: TournamentTeam[];
  // null adds a new match in the given week.
  match: TournamentMatch | null;
  round: number;
  onDone(notice: string): void;
  onCancel(): void;
}) {
  const [draft, setDraft] = useState<MatchDraft>(() =>
    match ? matchDraftOf(match) : emptyMatchDraft(round),
  );
  const [errors, setErrors] = useState<MatchErrors>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'save' | 'delete'>('');

  const change = (key: keyof MatchDraft) => (value: string) => {
    setDraft(current => ({ ...current, [key]: value }));
    setError('');
  };

  async function save() {
    if (busy) return;
    const found = validateMatch(draft);
    setErrors(found);
    setError('');
    if (Object.keys(found).length) return;
    Keyboard.dismiss();
    setBusy('save');
    try {
      await service.saveMatch(
        token,
        tournamentId,
        match?.id ?? null,
        toMatchInput(draft),
      );
      onDone(text.matchSaved);
    } catch (failure) {
      setErrors(matchFieldErrors(failure));
      setError(errorMessage(failure));
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    if (busy || !match) return;
    const confirmed = await confirmAction(
      text.deleteMatchTitle,
      text.deleteMatchBody(match.homeName, match.awayName),
      text.deleteMatch,
    );
    if (!confirmed) return;
    setBusy('delete');
    setError('');
    try {
      await service.deleteMatch(token, tournamentId, match.id);
      onDone(text.matchDeleted);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy('');
    }
  }

  function teamPicker(side: 'homeEntryId' | 'awayEntryId') {
    return (
      <View style={styles.group}>
        <Text style={styles.label}>
          {side === 'homeEntryId' ? labels.home : labels.away}
        </Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={
            side === 'homeEntryId' ? labels.home : labels.away
          }
          style={styles.chips}
        >
          {teams.map(team => (
            <Chip
              key={team.entryId}
              label={team.name}
              selected={draft[side] === team.entryId}
              disabled={!!busy}
              onPress={() => {
                change(side)(team.entryId);
                setErrors(current => ({ ...current, teams: undefined }));
              }}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text accessibilityRole="header" style={styles.title}>
        {match ? text.editMatch : text.newMatch}
      </Text>
      <Field
        label={labels.round}
        value={draft.round}
        onChangeText={change('round')}
        keyboardType="number-pad"
        maxLength={3}
        editable={!busy}
        error={errors.round}
      />
      {teamPicker('homeEntryId')}
      {teamPicker('awayEntryId')}
      {errors.teams ? (
        <Text accessibilityRole="alert" style={styles.fieldError}>
          {errors.teams}
        </Text>
      ) : null}
      <View style={styles.pair}>
        <View style={styles.half}>
          <Field
            label={labels.kickoffDate}
            value={draft.kickoffDate}
            onChangeText={change('kickoffDate')}
            placeholder={text.dayPlaceholder}
            maxLength={10}
            editable={!busy}
          />
        </View>
        <View style={styles.half}>
          <Field
            label={labels.kickoffTime}
            value={draft.kickoffTime}
            onChangeText={change('kickoffTime')}
            placeholder={text.timePlaceholder}
            maxLength={5}
            editable={!busy}
          />
        </View>
      </View>
      {errors.kickoff ? (
        <Text accessibilityRole="alert" style={styles.fieldError}>
          {errors.kickoff}
        </Text>
      ) : null}
      <Field
        label={labels.venue}
        value={draft.venue}
        onChangeText={change('venue')}
        maxLength={tournamentLimits.matchVenue}
        editable={!busy}
        error={errors.venue}
      />
      <View style={styles.pair}>
        <View style={styles.half}>
          <Field
            label={labels.homeGoals}
            value={draft.homeGoals}
            onChangeText={change('homeGoals')}
            keyboardType="number-pad"
            maxLength={2}
            editable={!busy}
          />
        </View>
        <View style={styles.half}>
          <Field
            label={labels.awayGoals}
            value={draft.awayGoals}
            onChangeText={change('awayGoals')}
            keyboardType="number-pad"
            maxLength={2}
            editable={!busy}
          />
        </View>
      </View>
      {errors.score ? (
        <Text accessibilityRole="alert" style={styles.fieldError}>
          {errors.score}
        </Text>
      ) : (
        <Text style={styles.hint}>{text.scoreHelp}</Text>
      )}
      <ErrorBanner message={error} />
      <Button
        label={text.saveMatch}
        loading={busy === 'save'}
        disabled={!!busy}
        onPress={save}
      />
      {match ? (
        <Button
          label={text.deleteMatch}
          secondary
          loading={busy === 'delete'}
          disabled={!!busy}
          onPress={remove}
        />
      ) : null}
      <Button
        label={text.cancelForm}
        secondary
        disabled={!!busy}
        onPress={onCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: space.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  group: { gap: space.sm },
  label: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1, minWidth: 0 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  fieldError: { color: colors.danger, fontSize: 12, lineHeight: 18 },
});
