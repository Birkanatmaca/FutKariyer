import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, Check, UserRound } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Field } from '../../../shared/ui/Field';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type {
  DeclaredLicenseStatus,
  PlayerFootballType,
} from '../../../shared/domain/football';
import { createPlayerProfileService } from '../application/profile-service';
import { playerProfileRepository } from '../data/http-profile-repository';
import type {
  DominantFoot,
  PlayerAvailability,
  PlayerProfile,
  SavePlayerProfile,
} from '../domain/profile';

const profileService = createPlayerProfileService(playerProfileRepository);
const feet: { value: DominantFoot; label: string }[] = [
  { value: 'right', label: copy.playerProfile.feet.right },
  { value: 'left', label: copy.playerProfile.feet.left },
  { value: 'both', label: copy.playerProfile.feet.both },
];
const availabilities: { value: PlayerAvailability; label: string }[] = [
  {
    value: 'seeking_team',
    label: copy.playerProfile.availabilities.seeking_team,
  },
  {
    value: 'open_to_offers',
    label: copy.playerProfile.availabilities.open_to_offers,
  },
  {
    value: 'not_available',
    label: copy.playerProfile.availabilities.not_available,
  },
];
const blankProfile: PlayerProfile = {
  position: '',
  dominantFoot: '',
  experienceYears: 0,
  currentClub: '',
  availability: 'not_available',
  discoverable: false,
  footballType: 'unknown',
  licenseStatus: 'unknown',
  updatedAt: '',
};

type Props = { token: string | null; onBack(): void };

export function PlayerProfileScreen({ token, onBack }: Props) {
  const [profile, setProfile] = useState<PlayerProfile>(blankProfile);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!token) {
      setError(copy.playerProfile.sessionError);
      setLoading(false);
      return;
    }
    try {
      setProfile(await profileService.get(token));
      setProfileReady(true);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function update<K extends keyof SavePlayerProfile>(
    key: K,
    value: SavePlayerProfile[K],
  ) {
    setProfile(current => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function save() {
    if (!token || saving) {
      return;
    }
    if (
      profile.footballType === 'unknown' ||
      profile.licenseStatus === 'unknown'
    ) {
      setError(copy.playerProfile.matchingRequired);
      setSaved(false);
      return;
    }
    setError(null);
    setSaved(false);
    setSaving(true);
    const input: SavePlayerProfile = {
      position: profile.position,
      dominantFoot: profile.dominantFoot,
      experienceYears: profile.experienceYears,
      currentClub: profile.currentClub,
      availability: profile.availability,
      discoverable: profile.discoverable,
      footballType: profile.footballType as PlayerFootballType,
      licenseStatus: profile.licenseStatus as DeclaredLicenseStatus,
    };
    try {
      setProfile(await profileService.save(token, input));
      setSaved(true);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.form.back}
          hitSlop={10}
          onPress={onBack}
          style={styles.back}
        >
          <ArrowLeft color={colors.text} size={20} />
        </Pressable>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>{copy.playerProfile.eyebrow}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {copy.playerProfile.title}
          </Text>
        </View>
        <UserRound color={colors.brand} size={22} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.helper}>{copy.playerProfile.loading}</Text>
        </View>
      ) : !profileReady ? (
        <>
          <ErrorBanner message={error} />
          <Button label={copy.form.retry} loading={loading} onPress={load} />
        </>
      ) : (
        <>
          <View style={styles.section}>
            <View style={styles.sectionIntro}>
              <Text style={styles.sectionTitle}>
                {copy.playerProfile.matching}
              </Text>
              <Text style={styles.helper}>
                {copy.playerProfile.matchingHint}
              </Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>{copy.signUp.footballType}</Text>
              <View style={styles.choices}>
                {(['amateur', 'professional', 'halisaha'] as const).map(
                  value => (
                    <Choice
                      key={value}
                      label={copy.football.types[value]}
                      selected={profile.footballType === value}
                      disabled={saving}
                      onPress={() => update('footballType', value)}
                    />
                  ),
                )}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>{copy.playerProfile.licenseStatus}</Text>
              <View style={styles.choices}>
                {(['licensed', 'unlicensed'] as const).map(value => (
                  <Choice
                    key={value}
                    label={copy.football.licenseStatuses[value]}
                    selected={profile.licenseStatus === value}
                    disabled={saving}
                    onPress={() => update('licenseStatus', value)}
                  />
                ))}
              </View>
              <Text style={styles.helper}>
                {copy.playerProfile.licenseDeclaration}
              </Text>
            </View>
          </View>
          <View style={styles.section}>
            <View style={styles.sectionIntro}>
              <Text style={styles.sectionTitle}>
                {copy.playerProfile.details}
              </Text>
              <Text style={styles.helper}>
                {copy.playerProfile.detailsHint}
              </Text>
            </View>
            <Field
              label={copy.playerProfile.position}
              value={profile.position}
              onChangeText={value => update('position', value)}
              placeholder={copy.playerProfile.positionPlaceholder}
              maxLength={40}
              editable={!saving}
            />
            <View style={styles.field}>
              <Text style={styles.label}>{copy.playerProfile.foot}</Text>
              <View style={styles.choices}>
                {feet.map(option => (
                  <Choice
                    key={option.value}
                    label={option.label}
                    selected={profile.dominantFoot === option.value}
                    disabled={saving}
                    onPress={() => update('dominantFoot', option.value)}
                  />
                ))}
              </View>
            </View>
            <Field
              label={copy.playerProfile.experience}
              value={String(profile.experienceYears)}
              onChangeText={value =>
                update(
                  'experienceYears',
                  value === '' ? 0 : Number(value.replace(/[^0-9]/g, '')),
                )
              }
              placeholder="0"
              keyboardType="number-pad"
              maxLength={2}
              editable={!saving}
            />
            <Field
              label={copy.playerProfile.currentClub}
              value={profile.currentClub}
              onChangeText={value => update('currentClub', value)}
              placeholder={copy.playerProfile.clubPlaceholder}
              hint={copy.playerProfile.clubHint}
              maxLength={100}
              editable={!saving}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionIntro}>
              <Text style={styles.sectionTitle}>
                {copy.playerProfile.status}
              </Text>
              <Text style={styles.helper}>{copy.playerProfile.statusHint}</Text>
            </View>
            <View style={styles.availabilityList}>
              {availabilities.map(option => (
                <Choice
                  key={option.value}
                  label={option.label}
                  selected={profile.availability === option.value}
                  disabled={saving}
                  onPress={() => update('availability', option.value)}
                />
              ))}
            </View>
          </View>

          <View style={styles.visibility}>
            <View style={styles.visibilityCopy}>
              <Text style={styles.sectionTitle}>
                {copy.playerProfile.visibility}
              </Text>
              <Text style={styles.helper}>
                {copy.playerProfile.visibilityHint}
              </Text>
            </View>
            <Switch
              accessibilityLabel={copy.playerProfile.visibility}
              value={profile.discoverable}
              disabled={saving}
              onValueChange={value => update('discoverable', value)}
              trackColor={{ false: colors.border, true: colors.brand }}
              thumbColor={profile.discoverable ? colors.brandInk : colors.text}
            />
          </View>

          <ErrorBanner message={error} />
          {saved && (
            <View accessibilityLiveRegion="polite" style={styles.success}>
              <Check color={colors.success} size={17} />
              <Text style={styles.successText}>{copy.playerProfile.saved}</Text>
            </View>
          )}
          <Button
            label={copy.playerProfile.save}
            loading={saving}
            onPress={save}
          />
        </>
      )}
    </Screen>
  );
}

function Choice({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCopy: { flex: 1, gap: space.xs },
  eyebrow: {
    color: colors.muted,
    fontSize: 9,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  title: { color: colors.text, fontSize: 25, fontWeight: '800' },
  loading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  section: {
    padding: space.xl,
    gap: space.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  sectionIntro: { gap: space.sm },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  helper: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  field: { gap: space.sm },
  label: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  choice: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: space.lg,
  },
  choiceSelected: {
    backgroundColor: colors.brandWash,
    borderColor: colors.brand,
  },
  choiceText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  choiceTextSelected: { color: colors.brand },
  availabilityList: { gap: space.sm },
  visibility: {
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  visibilityCopy: { flex: 1, gap: space.sm },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
  },
  successText: { color: colors.success, fontSize: 13, fontWeight: '600' },
});
