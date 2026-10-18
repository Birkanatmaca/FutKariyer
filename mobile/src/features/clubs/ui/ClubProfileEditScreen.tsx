import React, { useCallback, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Field } from '../../../shared/ui/Field';
import { TopBar } from '../../../shared/ui/TopBar';
import { Screen } from '../../../shared/ui/Screen';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import {
  clubProfileLimits,
  type ClubProfile,
  type ClubProfileInput,
} from '../domain/models';
import type { ClubService } from '../application/club-service';
import {
  mapServerFields,
  textLength,
  validateClubProfile,
  clubProfileFields,
  type FormErrors,
} from '../application/validation';
import { SectionStatus } from './ClubPrimitives';

export function ClubProfileEditScreen({
  token,
  service,
  onBack,
}: {
  token: string;
  service: ClubService;
  onBack(): void;
}) {
  const load = useCallback(() => service.profile(token), [service, token]);
  const state = useFocusedResource(load);
  return (
    <Screen>
      <TopBar title={copy.clubProfile.title} onBack={onBack} />
      <SectionStatus
        loading={state.loading}
        error={state.error}
        onRetry={state.retry}
      />
      {state.data ? (
        <ClubProfileForm token={token} service={service} profile={state.data} />
      ) : null}
    </Screen>
  );
}

const labels: Record<keyof ClubProfileInput, string> = {
  district: copy.clubProfile.district,
  description: copy.clubProfile.aboutLabel,
  venueName: copy.clubProfile.venueName,
  venueAddress: copy.clubProfile.venueAddress,
  trainingGroundName: copy.clubProfile.trainingGroundName,
  trainingGroundAddress: copy.clubProfile.trainingGroundAddress,
  trainingSchedule: copy.clubProfile.trainingSchedule,
};

const multiline: (keyof ClubProfileInput)[] = [
  'description',
  'venueAddress',
  'trainingGroundAddress',
  'trainingSchedule',
];

function toInput(profile: ClubProfile): ClubProfileInput {
  return {
    district: profile.district,
    description: profile.description,
    venueName: profile.venueName,
    venueAddress: profile.venueAddress,
    trainingGroundName: profile.trainingGroundName,
    trainingGroundAddress: profile.trainingGroundAddress,
    trainingSchedule: profile.trainingSchedule,
  };
}

function ClubProfileForm({
  token,
  service,
  profile,
}: {
  token: string;
  service: ClubService;
  profile: ClubProfile;
}) {
  const [values, setValues] = useState<ClubProfileInput>(() =>
    toInput(profile),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  function change(field: keyof ClubProfileInput, value: string) {
    setValues(current => ({ ...current, [field]: value }));
    setErrors(current => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setNotice('');
  }

  async function save() {
    if (busy) return;
    const validation = validateClubProfile(values);
    setErrors(validation);
    setFormError('');
    setNotice('');
    if (Object.keys(validation).length) return;
    Keyboard.dismiss();
    setBusy(true);
    try {
      await service.updateProfile(token, values);
      setNotice(copy.clubProfile.saved);
    } catch (failure) {
      if (failure instanceof ApiError) {
        setErrors(mapServerFields(failure.fields, clubProfileFields));
      }
      setFormError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <View style={styles.readOnly}>
        <Text style={styles.readOnlyLabel}>{copy.clubProfile.name}</Text>
        <Text style={styles.readOnlyValue}>{profile.name}</Text>
        <Text style={styles.readOnlyLabel}>
          {copy.clubProfile.footballType}
        </Text>
        <Text style={styles.readOnlyValue}>
          {copy.football.types[profile.footballType]}
        </Text>
        <Text style={styles.note}>{copy.clubProfile.readOnlyNote}</Text>
      </View>
      {clubProfileFields.map(field => {
        const length = textLength(values[field]);
        const max = clubProfileLimits[field];
        return (
          <Field
            key={field}
            label={labels[field]}
            value={values[field]}
            onChangeText={text => change(field, text)}
            multiline={multiline.includes(field)}
            error={errors[field]}
            hint={copy.clubProfile.counter(length, max)}
            editable={!busy}
          />
        );
      })}
      {formError ? <ErrorBanner message={formError} /> : null}
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      <Button label={copy.clubProfile.save} loading={busy} onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  readOnly: {
    padding: space.lg,
    gap: space.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  readOnlyLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  readOnlyValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: space.xs,
  },
  note: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  notice: { color: colors.success, fontSize: 13, lineHeight: 19 },
});
