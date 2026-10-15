import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, LockKeyhole } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { confirmSignOut } from './confirm-sign-out';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import { useAuth } from '../application/AuthProvider';
export function AccountScreen({
  onBack,
  settings = !!onBack,
  extra,
}: {
  onBack?: () => void;
  settings?: boolean;
  // Settings supplied by the app shell (e.g. Pro private browsing).
  extra?: React.ReactNode;
} = {}) {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) {
    return null;
  }
  const initials = user.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(name => name[0])
    .join('')
    .toLocaleUpperCase('tr-TR');
  async function logout() {
    if (busy || !(await confirmSignOut())) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await signOut();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }
  const details = [
    [
      user.role === 'club'
        ? copy.profile.clubName
        : user.role === 'organizer'
        ? copy.profile.organizerName
        : copy.profile.name,
      user.fullName,
    ],
    [
      user.username ? copy.form.username : copy.profile.email,
      user.username || user.email,
    ],
    [copy.profile.role, copy.roles[user.role]],
  ];
  return (
    <Screen>
      {onBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.form.back}
          onPress={onBack}
          style={styles.back}
        >
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
      )}
      <PageHeader
        eyebrow={copy.profile.eyebrow}
        title={settings ? copy.playerOverview.settings : copy.profile.title}
        description={
          settings ? copy.playerOverview.settingsHint : copy.profile.description
        }
      />
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.name}>{user.fullName}</Text>
          <Text style={styles.role}>{copy.roles[user.role]}</Text>
        </View>
      </View>
      <View style={styles.details}>
        <Text style={styles.eyebrow}>{copy.profile.account}</Text>
        {details.map(([label, value]) => (
          <View key={label} style={styles.detail}>
            <Text style={styles.label}>{label}</Text>
            <Text selectable style={styles.value}>
              {value}
            </Text>
          </View>
        ))}
      </View>
      {user.role === 'player' && (
        <View style={styles.note}>
          <LockKeyhole size={18} color={colors.brand} />
          <View style={styles.noteContent}>
            <Text style={styles.noteTitle}>{copy.profile.privacyTitle}</Text>
            <Text style={styles.noteText}>{copy.profile.privacyBody}</Text>
          </View>
        </View>
      )}
      {settings ? extra : null}
      <Button
        label={copy.profile.logout}
        secondary
        loading={busy}
        onPress={logout}
      />
      <ErrorBanner message={error} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.sm,
  },
  identityCopy: { flex: 1, gap: space.sm },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 24, fontWeight: '800', color: colors.brand },
  name: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.text,
  },
  role: { fontSize: 13, color: colors.secondary },
  details: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: space.xl,
    gap: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '600',
    color: colors.muted,
  },
  detail: { gap: space.xs },
  label: { fontSize: 12, color: colors.secondary },
  value: { fontSize: 15, lineHeight: 22, color: colors.text },
  note: {
    flexDirection: 'row',
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.brandWash,
  },
  noteContent: { flex: 1, gap: space.sm },
  noteTitle: { color: colors.text, fontWeight: '600', fontSize: 13 },
  noteText: { color: colors.secondary, fontSize: 12, lineHeight: 20 },
});
