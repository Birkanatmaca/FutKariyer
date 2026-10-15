import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Square, SquareCheck } from 'lucide-react-native';
import { ApiError } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Field } from '../../../shared/ui/Field';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import type { TournamentsService } from '../application/tournaments-service';
import {
  errorMessage,
  isFinalEntryError,
  textLength,
  toggleRosterPlayer,
} from '../application/validation';
import {
  tournamentLimits,
  type RosterCandidate,
  type TournamentEntry,
} from '../domain/models';

const text = copy.tournaments;

export function TournamentEntryForm({
  token,
  tournamentId,
  service,
  loadSquad,
  onSubmitted,
  onCancel,
}: {
  token: string;
  tournamentId: string;
  service: TournamentsService;
  loadSquad(token: string): Promise<RosterCandidate[]>;
  onSubmitted(entry: TournamentEntry): void;
  // Called with true when the server says another attempt cannot succeed.
  onCancel(blocked: boolean, message: string): void;
}) {
  const squad = useFocusedResource(
    useCallback(() => loadSquad(token), [loadSquad, token]),
  );
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [messageError, setMessageError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const full = selected.length >= tournamentLimits.roster;

  async function submit() {
    if (busy) return;
    setFormError('');
    if (textLength(message) > tournamentLimits.message) {
      setMessageError(text.tooLong(tournamentLimits.message));
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      onSubmitted(
        await service.enter(token, tournamentId, {
          message,
          playerIds: selected,
        }),
      );
    } catch (failure) {
      if (isFinalEntryError(failure)) {
        onCancel(true, errorMessage(failure));
        return;
      }
      const field =
        failure instanceof ApiError ? failure.fields.message : undefined;
      setMessageError(typeof field === 'string' ? field : '');
      setFormError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text accessibilityRole="header" style={styles.title}>
        {text.entryTitle}
      </Text>
      <Field
        label={text.message}
        value={message}
        onChangeText={value => {
          setMessage(value);
          setMessageError('');
        }}
        multiline
        editable={!busy}
        error={messageError}
        hint={text.counter(textLength(message), tournamentLimits.message)}
      />
      <View style={styles.rosterHead}>
        <Text style={styles.label}>{text.roster}</Text>
        <Text style={[styles.count, full && styles.countFull]}>
          {text.rosterCount(selected.length, tournamentLimits.roster)}
        </Text>
      </View>
      {full ? (
        <Text style={styles.hint}>
          {text.rosterFull(tournamentLimits.roster)}
        </Text>
      ) : null}
      {squad.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : squad.error ? (
        <>
          <ErrorBanner message={squad.error} />
          <Button label={copy.form.retry} secondary onPress={squad.retry} />
        </>
      ) : squad.data?.length ? (
        <View style={styles.roster}>
          {squad.data.map(player => {
            const checked = selected.includes(player.id);
            const disabled = busy || (!checked && full);
            const Icon = checked ? SquareCheck : Square;
            return (
              <Pressable
                key={player.id}
                accessibilityRole="checkbox"
                accessibilityLabel={player.name}
                accessibilityState={{ checked, disabled }}
                disabled={disabled}
                onPress={() =>
                  setSelected(current => toggleRosterPlayer(current, player.id))
                }
                style={[
                  styles.player,
                  checked && styles.playerChecked,
                  disabled && styles.disabled,
                ]}
              >
                <Icon
                  size={20}
                  color={checked ? colors.brand : colors.secondary}
                />
                <View style={styles.playerText}>
                  <Text style={styles.name}>{player.name}</Text>
                  <Text style={styles.position}>
                    {player.position || text.noPosition}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={styles.hint}>{text.rosterEmpty}</Text>
      )}
      <ErrorBanner message={formError} />
      <Button
        label={busy ? text.sending : text.submit}
        loading={busy}
        disabled={squad.loading}
        onPress={submit}
      />
      <Button
        label={text.cancelForm}
        secondary
        disabled={busy}
        onPress={() => onCancel(false, '')}
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
  rosterHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.sm,
  },
  label: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  count: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  countFull: { color: colors.warning },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  roster: { gap: space.sm },
  player: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
  },
  playerChecked: { borderColor: colors.brand },
  playerText: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  position: { color: colors.muted, fontSize: 12 },
  disabled: { opacity: 0.45 },
});
