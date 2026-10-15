import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { BackLink } from '../../../shared/ui/BackLink';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { ModerationService } from '../application/moderation-service';

const text = copy.moderation;

export function BlockedUsersScreen({
  token,
  service,
  onBack,
}: {
  token: string;
  service: ModerationService;
  onBack(): void;
}) {
  const load = useCallback(() => service.blocks(token), [service, token]);
  const state = useFocusedResource(load);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function unblock(id: string) {
    if (busy) return;
    setBusy(id);
    setError('');
    try {
      await service.unblock(token, id);
      state.retry();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy('');
    }
  }
  return (
    <Screen>
      <BackLink label={copy.form.back} onPress={onBack} />
      <PageHeader
        eyebrow={text.blockedEyebrow}
        title={text.blockedTitle}
        hint={text.blockedHint}
      />
      <ErrorBanner message={error} />
      {state.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} onPress={state.retry} />
        </>
      ) : state.data?.length ? (
        state.data.map(item => (
          <View key={item.id} style={styles.row}>
            <View style={styles.identity}>
              <Text style={styles.name}>{item.fullName}</Text>
              <Text style={styles.role}>{copy.roles[item.role]}</Text>
            </View>
            <Button
              label={text.unblock}
              accessibilityLabel={text.unblockNamed(item.fullName)}
              secondary
              loading={busy === item.id}
              disabled={!!busy}
              onPress={() => unblock(item.id)}
            />
          </View>
        ))
      ) : (
        <EmptyState icon={ShieldCheck} title={text.noBlocked} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  identity: { flex: 1, gap: space.xs },
  name: { ...type.headline, color: colors.text },
  role: { ...type.caption, color: colors.muted },
});
