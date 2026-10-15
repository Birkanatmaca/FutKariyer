import React, { useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Field } from '../../../shared/ui/Field';
import { copy } from '../../../shared/lib/copy';
import { colors, space } from '../../../styles/tokens';
import type { TournamentsService } from '../application/tournaments-service';
import {
  createErrorMessage,
  emptyTournamentDraft,
  textLength,
  toTournamentInput,
  tournamentFieldErrors,
  validateTournament,
  type TournamentDraft,
  type TournamentErrors,
} from '../application/validation';
import {
  tournamentFormats,
  tournamentLimits,
  tournamentTeamTypes,
  type CreatedTournament,
} from '../domain/models';
import { Chip } from './TournamentParts';

const text = copy.tournaments;
const labels = text.labels;
type TextField =
  | 'name'
  | 'district'
  | 'venue'
  | 'description'
  | 'startsOn'
  | 'endsOn'
  | 'applicationDeadline'
  | 'teamCapacity';
const dayFields = ['startsOn', 'endsOn', 'applicationDeadline'] as const;

export function TournamentForm({
  token,
  service,
  onCreated,
  onCancel,
}: {
  token: string;
  service: TournamentsService;
  onCreated(result: CreatedTournament): void;
  onCancel(): void;
}) {
  const [draft, setDraft] = useState<TournamentDraft>(emptyTournamentDraft);
  const [errors, setErrors] = useState<TournamentErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  function change<K extends keyof TournamentDraft>(
    key: K,
    value: TournamentDraft[K],
  ) {
    setDraft(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
  }

  function field(
    key: TextField,
    extra: Partial<React.ComponentProps<typeof Field>> = {},
  ) {
    return (
      <Field
        label={labels[key]}
        value={draft[key]}
        onChangeText={value => change(key, value)}
        editable={!busy}
        error={errors[key]}
        {...extra}
      />
    );
  }

  const counter = (key: 'name' | 'district' | 'venue' | 'description') =>
    text.counter(textLength(draft[key]), tournamentLimits[key].max);

  async function submit() {
    if (busy) return;
    const validation = validateTournament(draft);
    setErrors(validation);
    setFormError('');
    if (Object.keys(validation).length) return;
    Keyboard.dismiss();
    setBusy(true);
    try {
      const result = await service.create(token, toTournamentInput(draft));
      setDraft(emptyTournamentDraft);
      onCreated(result);
    } catch (failure) {
      setErrors(tournamentFieldErrors(failure));
      setFormError(createErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  function toggleType(type: (typeof tournamentTeamTypes)[number]) {
    change(
      'eligibleTypes',
      draft.eligibleTypes.includes(type)
        ? draft.eligibleTypes.filter(item => item !== type)
        : [...draft.eligibleTypes, type],
    );
  }

  return (
    <View style={styles.form}>
      {field('name', { hint: counter('name') })}
      <View style={styles.group}>
        <Text style={styles.label}>{labels.format}</Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={labels.format}
          style={styles.chips}
        >
          {tournamentFormats.map(format => (
            <Chip
              key={format}
              label={text.formats[format]}
              selected={draft.format === format}
              disabled={busy}
              onPress={() => change('format', format)}
            />
          ))}
        </View>
        <FieldError message={errors.format} />
      </View>
      <View style={styles.group}>
        <Text style={styles.label}>{labels.eligibleTypes}</Text>
        <View accessibilityLabel={labels.eligibleTypes} style={styles.chips}>
          {tournamentTeamTypes.map(type => (
            <Chip
              key={type}
              multi
              label={text.teamTypes[type]}
              selected={draft.eligibleTypes.includes(type)}
              disabled={busy}
              onPress={() => toggleType(type)}
            />
          ))}
        </View>
        <FieldError message={errors.eligibleTypes} />
      </View>
      {field('district', { hint: counter('district') })}
      {field('venue', { hint: counter('venue') })}
      {field('description', { multiline: true, hint: counter('description') })}
      {dayFields.map(key => (
        <React.Fragment key={key}>
          {field(key, {
            placeholder: text.dayPlaceholder,
            keyboardType: 'numbers-and-punctuation',
            autoCapitalize: 'none',
            autoCorrect: false,
            maxLength: 10,
          })}
        </React.Fragment>
      ))}
      {field('teamCapacity', {
        keyboardType: 'number-pad',
        maxLength: 3,
        hint: text.capacityHint(
          tournamentLimits.capacity.min,
          tournamentLimits.capacity.max,
        ),
      })}
      <ErrorBanner message={formError} />
      <Button label={text.publish} loading={busy} onPress={submit} />
      <Button
        label={text.cancelForm}
        secondary
        disabled={busy}
        onPress={onCancel}
      />
    </View>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <Text accessibilityRole="alert" style={styles.error}>
      {message}
    </Text>
  ) : null;
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  group: { gap: space.sm },
  label: { fontSize: 12, fontWeight: '600', color: colors.secondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  error: { fontSize: 12, lineHeight: 18, color: colors.danger },
});
