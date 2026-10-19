import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, Plus, X } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { Field } from '../../../shared/ui/Field';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { ApiError } from '../../../shared/api/client';
import { colors, radius, space } from '../../../styles/tokens';
import {
  coachAvailabilities,
  coachSpecialties,
  licenseLevels,
  maxPastClubs,
  type CoachProfile,
  type CoachRepository,
  type CoachVisibility,
} from '../domain/models';
import { Chip, Chips, Label, Section, ToggleRow } from './CoachPrimitives';

const text = copy.coaches;

// "Antrenör bilgileri": what a coach declares and what shows on the profile.
export function CoachProfileEditScreen({
  token,
  service,
  onBack,
  onSaved,
}: {
  token: string;
  service: CoachRepository;
  onBack(): void;
  onSaved?(profile: CoachProfile): void;
}) {
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [club, setClub] = useState('');
  const load = React.useCallback(() => {
    setError('');
    service
      .profile(token)
      .then(setProfile)
      .catch(failure =>
        setError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        ),
      );
  }, [service, token]);
  useEffect(load, [load]);
  function update(change: Partial<CoachProfile>) {
    setSaved(false);
    setProfile(value => (value ? { ...value, ...change } : value));
  }
  function show(key: keyof CoachVisibility, value: boolean) {
    if (profile)
      update({ visibility: { ...profile.visibility, [key]: value } });
  }
  function addClub() {
    const name = club.trim().replace(/\s+/g, ' ');
    if (!profile || name.length < 2 || profile.pastClubs.length >= maxPastClubs)
      return;
    update({ pastClubs: [...profile.pastClubs, name] });
    setClub('');
  }
  async function save() {
    if (!profile || saving) return;
    setSaving(true);
    setError('');
    try {
      const next = await service.saveProfile(token, profile);
      setProfile(next);
      setSaved(true);
      onSaved?.(next);
    } catch (failure) {
      setError(
        failure instanceof ApiError ? failure.message : copy.form.unexpected,
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Screen>
      <TopBar title={text.editTitle} onBack={onBack} />
      {!profile ? (
        error ? (
          <>
            <ErrorBanner message={error} />
            <Button label={copy.form.retry} onPress={load} />
          </>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.helper}>{text.loading}</Text>
          </View>
        )
      ) : (
        <>
          <Section title={text.license}>
            <Chips>
              {licenseLevels.map(level => (
                <Chip
                  key={level}
                  label={text.licenses[level]}
                  selected={profile.licenseLevel === level}
                  disabled={saving}
                  onPress={() => update({ licenseLevel: level })}
                />
              ))}
            </Chips>
            <Text style={styles.helper}>{text.declaration}</Text>
          </Section>
          <Section title={text.specialtiesLabel}>
            <Chips>
              {coachSpecialties.map(item => {
                const on = profile.specialties.includes(item);
                return (
                  <Chip
                    key={item}
                    multi
                    label={text.specialties[item]}
                    selected={on}
                    disabled={saving}
                    onPress={() =>
                      update({
                        specialties: on
                          ? profile.specialties.filter(s => s !== item)
                          : [...profile.specialties, item],
                      })
                    }
                  />
                );
              })}
            </Chips>
            <Field
              label={text.experience}
              value={String(profile.experienceYears)}
              onChangeText={value =>
                update({
                  experienceYears: Math.min(
                    60,
                    Number(value.replace(/[^0-9]/g, '') || 0),
                  ),
                })
              }
              keyboardType="number-pad"
              maxLength={2}
              editable={!saving}
            />
          </Section>
          <Section title={text.footballType}>
            <Chips>
              {(['amateur', 'professional', 'halisaha'] as const).map(kind => (
                <Chip
                  key={kind}
                  label={copy.football.types[kind]}
                  selected={profile.footballType === kind}
                  disabled={saving}
                  onPress={() => update({ footballType: kind })}
                />
              ))}
            </Chips>
            <Label>{text.availability}</Label>
            <Chips>
              {coachAvailabilities.map(item => (
                <Chip
                  key={item}
                  label={text.availabilities[item]}
                  selected={profile.availability === item}
                  disabled={saving}
                  onPress={() => update({ availability: item })}
                />
              ))}
            </Chips>
          </Section>
          <Section title={text.pastClubs} hint={text.pastClubsHint}>
            {profile.pastClubs.length ? (
              <View style={styles.clubs}>
                {profile.pastClubs.map((name, index) => (
                  <View key={name + index} style={styles.club}>
                    <Text numberOfLines={1} style={styles.clubName}>
                      {name}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={text.removeClub(name)}
                      hitSlop={8}
                      disabled={saving}
                      onPress={() =>
                        update({
                          pastClubs: profile.pastClubs.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      <X size={16} color={colors.secondary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            {profile.pastClubs.length < maxPastClubs ? (
              <View style={styles.addRow}>
                <View style={styles.addField}>
                  <Field
                    label={text.clubName}
                    value={club}
                    onChangeText={setClub}
                    onSubmitEditing={addClub}
                    returnKeyType="done"
                    maxLength={60}
                    editable={!saving}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={text.addClub}
                  disabled={saving || club.trim().length < 2}
                  onPress={addClub}
                  style={({ pressed }) => [
                    styles.add,
                    club.trim().length < 2 && styles.addDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Plus size={20} color={colors.brandInk} />
                </Pressable>
              </View>
            ) : null}
          </Section>
          <Section title={text.visibilityTitle} hint={text.hiddenNote}>
            {(['license', 'experience', 'football', 'clubs'] as const).map(
              key => (
                <ToggleRow
                  key={key}
                  label={text.visibility[key]}
                  value={profile.visibility[key]}
                  disabled={saving}
                  onChange={value => show(key, value)}
                />
              ),
            )}
          </Section>
          <ErrorBanner message={error} />
          {saved ? (
            <View accessibilityLiveRegion="polite" style={styles.success}>
              <Check color={colors.success} size={17} />
              <Text style={styles.successText}>{text.saved}</Text>
            </View>
          ) : null}
          <Button label={text.save} loading={saving} onPress={save} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  helper: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  clubs: { gap: space.sm },
  club: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  clubName: { flex: 1, color: colors.text, fontSize: 14 },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  addField: { flex: 1 },
  add: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  success: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  successText: { color: colors.success, fontSize: 13, fontWeight: '600' },
});
