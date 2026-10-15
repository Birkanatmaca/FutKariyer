import React, { useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import { BackLink } from '../../../../shared/ui/BackLink';
import { Button } from '../../../../shared/ui/Button';
import { ErrorBanner } from '../../../../shared/ui/ErrorBanner';
import { Field } from '../../../../shared/ui/Field';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { Screen } from '../../../../shared/ui/Screen';
import { ApiError } from '../../../../shared/api/client';
import { copy } from '../../../../shared/lib/copy';
import type { AdminServices } from '../../application/admin-services';
import { errorMessage } from '../../application/hooks';
import {
  matchDraft,
  toMatchForm,
  type FieldErrors,
  type MatchDraft,
} from '../../application/validation';
import type { LeagueMatch, LeagueTeam } from '../../domain/models';
import { Choices, SectionTitle, adminStyles } from '../parts/AdminParts';

const text = copy.admin.leagues;

// Fixture entry: week, optional local kickoff and an optional final score
// (both goals or neither).
export function MatchEditorScreen({
  services,
  leagueId,
  teams,
  match,
  onBack,
  onDone,
}: {
  services: AdminServices;
  leagueId: string;
  teams: LeagueTeam[];
  match?: LeagueMatch;
  onBack(): void;
  onDone(message: string): void;
}) {
  const [draft, setDraft] = useState<MatchDraft>(() =>
    matchDraft(
      match,
      teams.map(team => team.id),
    ),
  );
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  function change<K extends keyof MatchDraft>(key: K, value: MatchDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }
  async function save() {
    if (busy) return;
    const result = toMatchForm(draft);
    setError(null);
    if ('fields' in result) {
      setFields(result.fields);
      return;
    }
    setFields({});
    Keyboard.dismiss();
    setBusy(true);
    try {
      await services.leagues.saveMatch(leagueId, result.form, match?.id);
      onDone(text.matchSaved);
    } catch (failure) {
      if (failure instanceof ApiError) setFields(failure.fields);
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  const teamOptions = teams.map(team => ({ value: team.id, label: team.name }));
  const half = (children: React.ReactNode) => (
    <View style={adminStyles.flex}>{children}</View>
  );
  return (
    <Screen>
      <BackLink label={copy.admin.common.back} onPress={onBack} />
      <PageHeader
        eyebrow={text.eyebrow}
        title={match ? text.editMatch : text.newMatch}
      />
      <View style={adminStyles.form}>
        <Field
          label={text.round}
          value={draft.round}
          onChangeText={value => change('round', value)}
          error={fields.round}
          keyboardType="number-pad"
          maxLength={3}
          editable={!busy}
        />
        <Choices
          label={text.homeTeam}
          value={draft.homeTeamId}
          onChange={value => change('homeTeamId', value)}
          error={fields.homeTeamId}
          options={teamOptions}
          disabled={busy}
        />
        <Choices
          label={text.awayTeam}
          value={draft.awayTeamId}
          onChange={value => change('awayTeamId', value)}
          error={fields.awayTeamId}
          options={teamOptions}
          disabled={busy}
        />
        <SectionTitle title={text.date} hint={text.kickoffHint} />
        <View style={adminStyles.row}>
          {half(
            <Field
              label={text.date}
              value={draft.date}
              onChangeText={value => change('date', value)}
              error={fields.date || fields.kickoffAt}
              placeholder={text.datePlaceholder}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              editable={!busy}
            />,
          )}
          {half(
            <Field
              label={text.time}
              value={draft.time}
              onChangeText={value => change('time', value)}
              error={fields.time}
              placeholder={text.timePlaceholder}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              editable={!busy}
            />,
          )}
        </View>
        <View style={adminStyles.row}>
          {half(
            <Field
              label={text.homeGoals}
              value={draft.homeGoals}
              onChangeText={value => change('homeGoals', value)}
              error={fields.homeGoals}
              keyboardType="number-pad"
              maxLength={2}
              editable={!busy}
            />,
          )}
          {half(
            <Field
              label={text.awayGoals}
              value={draft.awayGoals}
              onChangeText={value => change('awayGoals', value)}
              error={fields.awayGoals}
              keyboardType="number-pad"
              maxLength={2}
              editable={!busy}
            />,
          )}
        </View>
        <Text style={adminStyles.rowMeta}>{text.scoreHint}</Text>
        <ErrorBanner message={error} />
        <Button label={text.saveMatch} onPress={save} loading={busy} />
      </View>
    </Screen>
  );
}
