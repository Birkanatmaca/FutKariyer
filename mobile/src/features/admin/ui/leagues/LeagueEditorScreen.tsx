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
  toLeagueForm,
  type FieldErrors,
  type LeagueDraft,
} from '../../application/validation';
import type { League, LeagueStatus } from '../../domain/models';
import { Choices, SectionTitle, adminStyles } from '../parts/AdminParts';

const text = copy.admin.leagues;

export function LeagueEditorScreen({
  services,
  league,
  onBack,
  onDone,
}: {
  services: AdminServices;
  league?: League;
  onBack(): void;
  onDone(saved: League, message: string): void;
}) {
  const [draft, setDraft] = useState<LeagueDraft>({
    name: league?.name ?? '',
    season: league?.season ?? '',
    description: league?.description ?? '',
    status: league?.status ?? 'draft',
    winPoints: String(league?.winPoints ?? 3),
    drawPoints: String(league?.drawPoints ?? 1),
    lossPoints: String(league?.lossPoints ?? 0),
  });
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  function change<K extends keyof LeagueDraft>(key: K, value: LeagueDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }
  async function save() {
    if (busy) return;
    const result = toLeagueForm(draft);
    setError(null);
    if ('fields' in result) {
      setFields(result.fields);
      return;
    }
    setFields({});
    Keyboard.dismiss();
    setBusy(true);
    try {
      const saved = await services.leagues.save(result.form, league?.id);
      onDone(saved, league ? text.saved : text.created);
    } catch (failure) {
      if (failure instanceof ApiError) setFields(failure.fields);
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  const points = (
    key: 'winPoints' | 'drawPoints' | 'lossPoints',
    label: string,
  ) => (
    <View style={adminStyles.flex}>
      <Field
        label={label}
        value={draft[key]}
        onChangeText={value => change(key, value)}
        error={fields[key]}
        keyboardType="number-pad"
        maxLength={2}
        editable={!busy}
      />
    </View>
  );
  return (
    <Screen>
      <BackLink label={copy.admin.common.back} onPress={onBack} />
      <PageHeader
        eyebrow={text.eyebrow}
        title={league ? text.edit : text.create}
      />
      <View style={adminStyles.form}>
        <Field
          label={text.name}
          value={draft.name}
          onChangeText={value => change('name', value)}
          error={fields.name}
          maxLength={120}
          editable={!busy}
        />
        <Field
          label={text.season}
          value={draft.season}
          onChangeText={value => change('season', value)}
          error={fields.season}
          placeholder="2026-2027"
          maxLength={40}
          editable={!busy}
        />
        <Field
          label={text.descriptionField}
          value={draft.description}
          onChangeText={value => change('description', value)}
          error={fields.description}
          maxLength={1000}
          multiline
          editable={!busy}
        />
        <Choices<LeagueStatus>
          label={text.status}
          value={draft.status}
          onChange={value => change('status', value)}
          error={fields.status}
          hint={text.liveNote}
          disabled={busy}
          options={(['draft', 'active', 'finished'] as const).map(value => ({
            value,
            label: text.statuses[value],
          }))}
        />
        <SectionTitle title={text.points} />
        <View style={adminStyles.row}>
          {points('winPoints', text.winPoints)}
          {points('drawPoints', text.drawPoints)}
          {points('lossPoints', text.lossPoints)}
        </View>
        <Text style={adminStyles.rowMeta}>
          {text.pointsRule(
            Number(draft.winPoints) || 0,
            Number(draft.drawPoints) || 0,
            Number(draft.lossPoints) || 0,
          )}
        </Text>
        <ErrorBanner message={error} />
        <Button label={text.save} onPress={save} loading={busy} />
      </View>
    </Screen>
  );
}
