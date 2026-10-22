import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Shield } from 'lucide-react-native';
import { confirmAction } from '../../connections';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import type { SquadService } from '../application/squad-service';
import type { SquadInvite, SquadInviteDecision } from '../domain/models';
import { formatDate } from './SquadParts';

const text = copy.squad;

// Player: open squad invitations from clubs; accepting joins the squad.
export function SquadInvitesScreen({
  token,
  service,
  onBack,
}: {
  token: string;
  service: SquadService;
  onBack(): void;
}) {
  const state = useFocusedResource(
    useCallback(() => service.playerInvites(token), [service, token]),
  );
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function respond(invite: SquadInvite, decision: SquadInviteDecision) {
    if (busy) return;
    if (
      decision === 'decline' &&
      !(await confirmAction(
        text.declineTitle,
        text.declineBody(invite.clubName),
        text.decline,
      ))
    )
      return;
    setBusy(invite.id + decision);
    setNotice('');
    setError('');
    try {
      await service.respondInvite(token, invite.id, decision);
      setNotice(
        decision === 'accept'
          ? text.joined(invite.clubName)
          : text.declined(invite.clubName),
      );
    } catch (failure) {
      setError(
        failure instanceof Error && failure.message
          ? failure.message
          : copy.form.unexpected,
      );
    } finally {
      setBusy('');
      state.retry();
    }
  }

  return (
    <Screen>
      <TopBar title={text.playerInvitesTitle} onBack={onBack} />
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      <ErrorBanner message={error} />
      {state.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} onPress={state.retry} />
        </>
      ) : state.data?.length ? (
        <View style={styles.list}>
          {state.data.map(invite => (
            <View key={invite.id} style={styles.card}>
              <Text accessibilityRole="header" style={styles.title}>
                {invite.clubName}
              </Text>
              {invite.message ? (
                <Text style={styles.message}>{invite.message}</Text>
              ) : null}
              <Text style={styles.meta}>
                {text.invitedAt(formatDate(invite.createdAt))}
              </Text>
              <View style={styles.actions}>
                <View style={styles.action}>
                  <Button
                    label={text.accept}
                    accessibilityLabel={text.accept + ': ' + invite.clubName}
                    compact
                    loading={busy === invite.id + 'accept'}
                    disabled={!!busy}
                    onPress={() => respond(invite, 'accept')}
                  />
                </View>
                <View style={styles.action}>
                  <Button
                    label={text.decline}
                    accessibilityLabel={text.decline + ': ' + invite.clubName}
                    compact
                    secondary
                    loading={busy === invite.id + 'decline'}
                    disabled={!!busy}
                    onPress={() => respond(invite, 'decline')}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : state.data ? (
        <EmptyState
          icon={Shield}
          title={text.playerInvitesEmptyTitle}
          body={text.playerInvitesEmptyBody}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { color: colors.success, fontSize: 13, lineHeight: 19 },
  list: { gap: space.md },
  card: {
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  message: { color: colors.secondary, fontSize: 13, lineHeight: 20 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  action: { flex: 1 },
});
