import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LockKeyhole, LogOut } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { confirmSignOut } from './confirm-sign-out';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import { useAuth } from '../application/AuthProvider';
export function AccountScreen() {
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
    [copy.profile.name, user.fullName],
    [copy.profile.email, user.email],
    [copy.profile.role, copy.roles[user.role]],
    [copy.profile.city, user.city],
  ];
  return (
    <Screen>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>{copy.profile.title}</Text>
        <LogOut size={20} color={colors.muted} />
      </View>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user.fullName}</Text>
        <Text style={styles.role}>
          {copy.roles[user.role]} · {user.city}
        </Text>
        <View style={styles.private}>
          <LockKeyhole size={11} color={colors.secondary} />
          <Text style={styles.privateText}>{copy.profile.private}</Text>
        </View>
      </View>
      <View style={styles.details}>
        <Text style={styles.eyebrow}>{copy.profile.account}</Text>
        {details.map(([label, value]) => (
          <View key={label} style={styles.detail}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.note}>
        <LockKeyhole size={18} color={colors.brand} />
        <View style={styles.noteContent}>
          <Text style={styles.noteTitle}>{copy.profile.privacyTitle}</Text>
          <Text style={styles.noteText}>{copy.profile.privacyBody}</Text>
        </View>
      </View>
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
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: { fontSize: 28, fontWeight: '800', color: colors.text },
  identity: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: radius.lg,
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 30, fontWeight: '800', color: colors.brand },
  name: {
    fontSize: 23,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  role: { fontSize: 13, color: colors.secondary },
  private: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  privateText: { fontSize: 9, letterSpacing: 1, color: colors.secondary },
  details: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: space.xl,
    gap: space.lg,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '600',
    color: colors.muted,
  },
  detail: { gap: space.xs },
  label: { fontSize: 11, color: colors.muted },
  value: { fontSize: 15, color: colors.text },
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
