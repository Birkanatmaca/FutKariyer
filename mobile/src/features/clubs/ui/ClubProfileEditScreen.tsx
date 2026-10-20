import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { Link2, Trophy } from 'lucide-react-native';
import { ApiError } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Field } from '../../../shared/ui/Field';
import { TopBar } from '../../../shared/ui/TopBar';
import { Screen } from '../../../shared/ui/Screen';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space, type } from '../../../styles/tokens';
import {
  clubProfileLimits,
  type ClubProfile,
  type ClubProfileInput,
  type ClubTffLink,
} from '../domain/models';
import type { ClubService } from '../application/club-service';
import { profileCompleteness } from '../application/club-center';
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
  onTff,
}: {
  token: string;
  service: ClubService;
  onBack(): void;
  // Opens the TFF Ankara team picker.
  onTff(): void;
}) {
  const load = useCallback(() => service.profile(token), [service, token]);
  const state = useFocusedResource(load);
  // The form keeps the first profile it got, so coming back from the TFF
  // picker refreshes the link without wiping edits that are not saved yet.
  const [first, setFirst] = useState<ClubProfile | null>(null);
  const [tff, setTff] = useState<ClubTffLink | null>(null);
  useEffect(() => {
    if (!state.data) return;
    const loaded = state.data;
    setFirst(current => current ?? loaded);
    setTff(loaded.tff);
  }, [state.data]);
  return (
    <Screen>
      <TopBar title={copy.clubProfile.title} onBack={onBack} />
      {first ? null : (
        <SectionStatus
          loading={state.loading}
          error={state.error}
          onRetry={state.retry}
        />
      )}
      {first ? (
        <ClubProfileForm
          token={token}
          service={service}
          profile={first}
          tffCard={
            <TffCard
              link={tff}
              onPick={onTff}
              onRemove={async () => setTff((await service.clearTff(token)).tff)}
            />
          }
        />
      ) : null}
    </Screen>
  );
}

// The club's TFF Ankara team, which feeds the league card on the home screen.
function TffCard({
  link,
  onPick,
  onRemove,
}: {
  link: ClubTffLink | null;
  onPick(): void;
  onRemove(): Promise<void>;
}) {
  const text = copy.clubProfile;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onRemove();
      setNotice(text.tffRemoved);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Trophy size={18} color={colors.brand} />
        </View>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          {text.tffTitle}
        </Text>
      </View>
      {link ? (
        <View style={styles.link}>
          <Link2 size={14} color={colors.brand} />
          <View style={styles.linkText}>
            <Text style={styles.readOnlyValue}>{link.team}</Text>
            <Text style={styles.note}>{link.label}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.note}>{text.tffEmpty}</Text>
      )}
      {error ? <ErrorBanner message={error} /> : null}
      {notice && !link ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            label={link ? text.tffChange : text.tffPick}
            compact
            secondary={!!link}
            disabled={busy}
            onPress={onPick}
          />
        </View>
        {link ? (
          <View style={styles.action}>
            <Button
              label={text.tffRemove}
              compact
              secondary
              loading={busy}
              onPress={remove}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// Moved here from the club home (20 Oct 2026); it follows the form live.
function CompletenessCard({ values }: { values: ClubProfileInput }) {
  const text = copy.clubHome;
  const view = profileCompleteness(values, labels);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>{text.completenessTitle}</Text>
        <Text style={styles.percent}>
          {text.completenessValue(view.percent)}
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={text.completenessTitle}
        accessibilityValue={{ min: 0, max: 100, now: view.percent }}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${view.percent}%` }]} />
      </View>
      {view.complete ? (
        <Text style={styles.note}>{text.profileComplete}</Text>
      ) : (
        <>
          <Text style={styles.note}>{text.missingTitle}</Text>
          <View style={styles.chips}>
            {view.missing.map(field => (
              <View key={field} style={styles.chip}>
                <Text style={styles.chipText}>{field}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
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
  tffCard,
}: {
  token: string;
  service: ClubService;
  profile: ClubProfile;
  tffCard: ReactNode;
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
      <CompletenessCard values={values} />
      {tffCard}
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
  card: {
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandWash,
  },
  cardTitle: { ...type.headline, fontSize: 15, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  percent: { color: colors.brand, fontSize: 13, fontWeight: '700' },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
  },
  chipText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  link: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.brandWash,
  },
  linkText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1 },
});
