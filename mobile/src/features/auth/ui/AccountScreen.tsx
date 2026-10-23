import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Ban,
  ChevronRight,
  KeyRound,
  LockKeyhole,
  MonitorSmartphone,
  Trash2,
} from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { TopBar } from '../../../shared/ui/TopBar';
import { Avatar } from '../../../shared/ui/Avatar';
import { confirmSignOut } from './confirm-sign-out';
import { DeleteAccountPrompt } from './DeleteAccountPrompt';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import { useAuth } from '../application/AuthProvider';
export function AccountScreen({
  onBack,
  settings = !!onBack,
  extra,
  onBlockedUsers,
  avatarUri,
  onEditProfile,
  onChangePassword,
  onSessions,
}: {
  onBack?: () => void;
  settings?: boolean;
  // Settings supplied by the app shell (e.g. Pro private browsing).
  extra?: React.ReactNode;
  // Opens the blocked accounts list (moderation feature).
  onBlockedUsers?: () => void;
  // Profile photo and the Profili düzenle entry (19 Oct 2026).
  avatarUri?: string;
  onEditProfile?: () => void;
  // Password and sessions for every account, organizers included (23 Oct 2026).
  onChangePassword?: () => void;
  onSessions?: () => void;
} = {}) {
  const { user, signOut, deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) {
    return null;
  }
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
      <TopBar
        title={settings ? copy.playerOverview.settings : copy.profile.title}
        onBack={onBack}
      />
      <Text style={styles.description}>
        {settings ? copy.playerOverview.settingsHint : copy.profile.description}
      </Text>
      <View style={styles.identity}>
        <Avatar
          name={user.fullName}
          uri={avatarUri}
          size={72}
          square={user.role === 'club'}
          style={styles.avatar}
        />
        <View style={styles.identityCopy}>
          <Text style={styles.name}>{user.fullName}</Text>
          <Text style={styles.role}>{copy.roles[user.role]}</Text>
        </View>
      </View>
      {onEditProfile ? (
        <Button
          label={copy.accountProfile.edit}
          secondary
          onPress={onEditProfile}
        />
      ) : null}
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
      {settings && onChangePassword ? (
        <Pressable
          accessibilityRole="button"
          onPress={onChangePassword}
          style={styles.row}
        >
          <KeyRound size={18} color={colors.secondary} />
          <Text style={styles.rowText}>
            {copy.accountProfile.changePassword}
          </Text>
          <ChevronRight size={18} color={colors.muted} />
        </Pressable>
      ) : null}
      {settings && onSessions ? (
        <Pressable
          accessibilityRole="button"
          onPress={onSessions}
          style={styles.row}
        >
          <MonitorSmartphone size={18} color={colors.secondary} />
          <Text style={styles.rowText}>{copy.accountProfile.sessions}</Text>
          <ChevronRight size={18} color={colors.muted} />
        </Pressable>
      ) : null}
      {settings && onBlockedUsers ? (
        <Pressable
          accessibilityRole="button"
          onPress={onBlockedUsers}
          style={styles.row}
        >
          <Ban size={18} color={colors.secondary} />
          <Text style={styles.rowText}>{copy.moderation.blockedTitle}</Text>
          <ChevronRight size={18} color={colors.muted} />
        </Pressable>
      ) : null}
      <Button
        label={copy.profile.logout}
        secondary
        loading={busy}
        onPress={logout}
      />
      <ErrorBanner message={error} />
      {settings ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setDeleting(true)}
          disabled={busy}
          style={styles.row}
        >
          <Trash2 size={18} color={colors.danger} />
          <Text style={[styles.rowText, styles.danger]}>
            {copy.account.delete}
          </Text>
        </Pressable>
      ) : null}
      <DeleteAccountPrompt
        visible={deleting}
        onCancel={() => setDeleting(false)}
        onDelete={deleteAccount}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  description: { ...type.body, color: colors.secondary },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.sm,
  },
  identityCopy: { flex: 1, gap: space.sm },
  avatar: { borderWidth: 2, borderColor: colors.brand },
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
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  danger: { color: colors.danger },
});
