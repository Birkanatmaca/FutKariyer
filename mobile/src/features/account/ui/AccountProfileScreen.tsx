import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AtSign,
  Calendar,
  Camera,
  ChevronRight,
  KeyRound,
  Mail,
  MapPin,
  MonitorSmartphone,
  Ruler,
  Trash2,
  UserRound,
  Weight,
  type LucideIcon,
} from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { Field } from '../../../shared/ui/Field';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Avatar } from '../../../shared/ui/Avatar';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import {
  accountLimits,
  fromIsoDate,
  toIsoDate,
  type AccountDraft,
  type AccountProfile,
  type AccountRepository,
} from '../domain/models';
import { avatarUrl } from '../data/http-account-repository';
import { useAccountProfile } from '../application/useAccountProfile';

type Form = {
  fullName: string;
  username: string;
  city: string;
  district: string;
  birthDate: string;
  bio: string;
  heightCm: string;
  weightKg: string;
};
function formFrom(p: AccountProfile): Form {
  return {
    fullName: p.fullName,
    username: p.username,
    city: p.city,
    district: p.district,
    birthDate: fromIsoDate(p.birthDate),
    bio: p.bio,
    heightCm: p.heightCm ? String(p.heightCm) : '',
    weightKg: p.weightKg ? String(p.weightKg) : '',
  };
}

// Profili düzenle (19 Oct 2026): profile photo, personal details and, for
// players and coaches, height and weight. Players also reach their football
// details from here.
export function AccountProfileScreen({
  token,
  repository,
  onBack,
  onFootball,
  footballLink,
  onChange,
  onChangePassword,
  onSessions,
}: {
  token: string;
  repository: AccountRepository;
  onBack(): void;
  // Players: opens the football profile (position, foot, availability…);
  // coaches: their coach details, with footballLink naming the page.
  onFootball?(): void;
  // Güvenlik (20 Oct 2026); absent in a switched club session.
  onChangePassword?: () => void;
  onSessions?: () => void;
  footballLink?: { title: string; hint: string };
  // Lets the screens behind this one show the new name and photo at once.
  onChange?(profile: AccountProfile): void;
}) {
  const text = copy.accountProfile;
  const {
    profile,
    setProfile,
    error: loadError,
    loading,
    reload,
  } = useAccountProfile(repository, token);
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  useEffect(() => {
    if (profile && !form) setForm(formFrom(profile));
  }, [profile, form]);
  useEffect(() => {
    if (profile) onChange?.(profile);
  }, [profile, onChange]);
  if (!profile || !form) {
    return (
      <Screen>
        <TopBar title={text.title} onBack={onBack} />
        {loading ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          <>
            <ErrorBanner message={loadError} />
            <Button label={copy.form.retry} onPress={reload} />
          </>
        )}
      </Screen>
    );
  }
  const physical = profile.role === 'player' || profile.role === 'coach';
  const change = (key: keyof Form) => (value: string) => {
    setForm(current => (current ? { ...current, [key]: value } : current));
    setNotice('');
  };

  async function changePhoto() {
    if (photoBusy) return;
    setError('');
    try {
      const photo = await repository.pickPhoto();
      if (!photo) return;
      setPhotoBusy(true);
      setProfile(await repository.uploadAvatar(token, photo));
      setNotice(text.photoSaved);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setPhotoBusy(false);
    }
  }
  async function removePhoto() {
    if (photoBusy) return;
    setPhotoBusy(true);
    setError('');
    try {
      setProfile(await repository.removeAvatar(token));
      setNotice(text.photoRemoved);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setPhotoBusy(false);
    }
  }
  async function save() {
    if (saving || !form) return;
    const problems: Record<string, string> = {};
    const birth = form.birthDate.trim() ? toIsoDate(form.birthDate) : '';
    if (birth === null) problems.birthDate = text.errors.birthDate;
    const number = (value: string) =>
      value.trim() ? Number(value.trim()) : null;
    const heightCm = number(form.heightCm);
    const weightKg = number(form.weightKg);
    if (
      heightCm !== null &&
      (!Number.isInteger(heightCm) ||
        heightCm < accountLimits.height[0] ||
        heightCm > accountLimits.height[1])
    )
      problems.heightCm = text.errors.height;
    if (
      weightKg !== null &&
      (!Number.isInteger(weightKg) ||
        weightKg < accountLimits.weight[0] ||
        weightKg > accountLimits.weight[1])
    )
      problems.weightKg = text.errors.weight;
    setFields(problems);
    setError('');
    setNotice('');
    if (Object.keys(problems).length) return;
    const draft: AccountDraft = {
      fullName: form.fullName,
      username: form.username,
      city: form.city,
      district: form.district,
      birthDate: birth || '',
      bio: form.bio,
      heightCm: physical ? heightCm : null,
      weightKg: physical ? weightKg : null,
    };
    setSaving(true);
    try {
      const saved = await repository.save(token, draft);
      setProfile(saved);
      setForm(formFrom(saved));
      setNotice(text.saved);
    } catch (failure) {
      if (failure instanceof ApiError) setFields(failure.fields);
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <TopBar
        title={text.title}
        onBack={onBack}
        accessory={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text.save}
            onPress={save}
            disabled={saving}
            hitSlop={8}
            style={styles.topSave}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.brandInk} />
            ) : (
              <Text style={styles.topSaveText}>{text.save}</Text>
            )}
          </Pressable>
        }
      />

      <View style={styles.photoCard}>
        <View>
          <Avatar
            name={profile.fullName}
            uri={avatarUrl(profile.id, profile.avatarVersion)}
            size={104}
            square={profile.role === 'club'}
            style={styles.photo}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text.changePhoto}
            onPress={changePhoto}
            disabled={photoBusy}
            style={styles.camera}
          >
            {photoBusy ? (
              <ActivityIndicator size="small" color={colors.brandInk} />
            ) : (
              <Camera size={18} color={colors.brandInk} />
            )}
          </Pressable>
        </View>
        <View style={styles.photoText}>
          <Text style={styles.photoName}>{profile.fullName}</Text>
          <Text style={styles.photoHint}>{text.photoHint}</Text>
          <View style={styles.photoActions}>
            <Pressable
              accessibilityRole="button"
              onPress={changePhoto}
              disabled={photoBusy}
              style={styles.photoButton}
            >
              <Text style={styles.photoButtonText}>
                {profile.avatarVersion ? text.changePhoto : text.addPhoto}
              </Text>
            </Pressable>
            {profile.avatarVersion ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text.removePhoto}
                onPress={removePhoto}
                disabled={photoBusy}
                hitSlop={8}
                style={styles.remove}
              >
                <Trash2 size={16} color={colors.danger} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <ErrorBanner message={error} />
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}

      <Section title={text.personal}>
        <Field
          label={text.fullName}
          icon={UserRound}
          value={form.fullName}
          onChangeText={change('fullName')}
          error={fields.fullName}
          maxLength={accountLimits.name[1]}
          autoComplete="name"
        />
        <Field
          label={text.username}
          icon={AtSign}
          value={form.username}
          onChangeText={value => change('username')(value.toLowerCase())}
          error={fields.username}
          placeholder={text.usernamePlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={32}
        />
        {profile.email ? (
          <Field
            label={text.email}
            icon={Mail}
            value={profile.email}
            editable={false}
            hint={text.emailHint}
          />
        ) : null}
        <Field
          label={text.birthDate}
          icon={Calendar}
          value={form.birthDate}
          onChangeText={change('birthDate')}
          error={fields.birthDate}
          placeholder={text.birthDatePlaceholder}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        <View style={styles.row}>
          <View style={styles.half}>
            <Field
              label={text.city}
              icon={MapPin}
              value={form.city}
              onChangeText={change('city')}
              error={fields.city}
              maxLength={accountLimits.city[1]}
            />
          </View>
          <View style={styles.half}>
            <Field
              label={text.district}
              value={form.district}
              onChangeText={change('district')}
              error={fields.district}
              placeholder={text.districtPlaceholder}
              maxLength={accountLimits.district}
            />
          </View>
        </View>
        <Field
          label={text.bio}
          value={form.bio}
          onChangeText={change('bio')}
          error={fields.bio}
          placeholder={text.bioPlaceholder}
          multiline
          maxLength={accountLimits.bio}
          hint={text.bioCount(form.bio.length, accountLimits.bio)}
        />
      </Section>

      {physical ? (
        <Section title={text.physical}>
          <View style={styles.row}>
            <View style={styles.half}>
              <Field
                label={text.height}
                icon={Ruler}
                value={form.heightCm}
                onChangeText={change('heightCm')}
                error={fields.heightCm}
                placeholder="180"
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
            <View style={styles.half}>
              <Field
                label={text.weight}
                icon={Weight}
                value={form.weightKg}
                onChangeText={change('weightKg')}
                error={fields.weightKg}
                placeholder="75"
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
          </View>
        </Section>
      ) : null}

      {onFootball ? (
        <Pressable
          accessibilityRole="button"
          onPress={onFootball}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <View style={styles.linkBody}>
            <Text style={styles.linkTitle}>
              {footballLink?.title ?? text.football}
            </Text>
            <Text style={styles.linkHint}>
              {footballLink?.hint ?? text.footballHint}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.muted} />
        </Pressable>
      ) : null}

      {onChangePassword || onSessions ? (
        <Section title={text.security}>
          {onChangePassword ? (
            <LinkRow
              icon={KeyRound}
              title={text.changePassword}
              hint={text.changePasswordHint}
              onPress={onChangePassword}
            />
          ) : null}
          {onSessions ? (
            <LinkRow
              icon={MonitorSmartphone}
              title={text.sessions}
              hint={text.sessionsHint}
              onPress={onSessions}
            />
          ) : null}
        </Section>
      ) : null}

      <Button label={text.save} loading={saving} onPress={save} />
      <View style={styles.tabBarSpace} />
    </Screen>
  );
}

function LinkRow({
  icon: Icon,
  title,
  hint,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.securityRow, pressed && styles.pressed]}
    >
      <Icon size={18} color={colors.brand} />
      <View style={styles.linkBody}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkHint}>{hint}</Text>
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  topSave: {
    minWidth: 72,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  topSaveText: { color: colors.brandInk, fontSize: 13, fontWeight: '800' },
  // The floating tab bar covers the bottom of the scroll view.
  tabBarSpace: { height: 60 },
  photoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  photo: { borderWidth: 2, borderColor: colors.brand },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  photoText: { flex: 1, gap: space.xs },
  photoName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  photoHint: { ...type.caption, color: colors.muted, lineHeight: 17 },
  photoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xs,
  },
  photoButton: {
    paddingHorizontal: space.md,
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandSoft,
  },
  photoButtonText: { color: colors.brand, fontSize: 13, fontWeight: '800' },
  remove: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerWash,
  },
  notice: { color: colors.success, fontSize: 13 },
  section: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  row: { flexDirection: 'row', gap: space.md },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xs,
  },
  half: { flex: 1 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  pressed: { opacity: 0.85 },
  linkBody: { flex: 1, gap: 2 },
  linkTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  linkHint: { ...type.caption, color: colors.muted },
});
