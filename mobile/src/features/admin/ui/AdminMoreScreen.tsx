import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LogOut } from 'lucide-react-native';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Screen } from '../../../shared/ui/Screen';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import { errorMessage } from '../application/hooks';
import { AdminMenu, MenuRow, type AdminDestination } from './AdminMenu';
import { confirm } from './parts/confirm';

const text = copy.admin.more;

export function AdminMoreScreen({
  name,
  email,
  onOpen,
  onSignOut,
}: {
  name: string;
  email: string;
  onOpen(destination: AdminDestination): void;
  onSignOut(): Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function signOut() {
    if (busy) return;
    if (!(await confirm(text.logoutTitle, text.logoutBody, text.logout)))
      return;
    setBusy(true);
    setError(null);
    try {
      await onSignOut();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }
  return (
    <Screen>
      <PageHeader
        eyebrow={copy.admin.eyebrow}
        title={text.title}
        description={text.description}
      />
      <AdminMenu
        onOpen={onOpen}
        only={['reports', 'leagues', 'gifts', 'announcements', 'payments']}
      />
      <View style={styles.account}>
        <View style={styles.avatar}>
          <Text style={styles.initial}>
            {name.charAt(0).toLocaleUpperCase('tr-TR')}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.meta}>
            {text.account}
            {email ? ' · ' + email : ''}
          </Text>
        </View>
      </View>
      <ErrorBanner message={error} />
      <MenuRow
        title={text.logout}
        hint={text.logoutHint}
        icon={LogOut}
        tone="danger"
        onPress={signOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  initial: { color: colors.brand, fontSize: 18, fontWeight: '800' },
  flex: { flex: 1, minWidth: 0 },
  name: { ...type.headline, color: colors.text },
  meta: { ...type.caption, color: colors.muted },
});
