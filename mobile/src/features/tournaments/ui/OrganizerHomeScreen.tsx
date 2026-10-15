import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Medal, ShieldAlert } from 'lucide-react-native';
import { useAuth } from '../../auth';
import { Brand } from '../../../shared/ui/Brand';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Screen } from '../../../shared/ui/Screen';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import type { TournamentsService } from '../application/tournaments-service';
import type { CreatedTournament } from '../domain/models';
import { TournamentCard } from './TournamentParts';
import { TournamentForm } from './TournamentForm';

const text = copy.tournaments;

export function OrganizerHomeScreen({
  service,
  onOpen,
}: {
  service: TournamentsService;
  onOpen(id: string): void;
}) {
  const { user, token } = useAuth();
  const state = useFocusedResource(
    useCallback(
      () =>
        token
          ? service.mine(token)
          : Promise.reject(new Error(copy.playerProfile.sessionError)),
      [service, token],
    ),
  );
  const [composing, setComposing] = useState(false);
  const [notice, setNotice] = useState('');

  function created(result: CreatedTournament) {
    setComposing(false);
    setNotice(text.published + ' ' + text.notified(result.notifiedClubs));
    state.retry();
  }

  return (
    <Screen>
      <Brand />
      <PageHeader
        eyebrow={text.organizerEyebrow}
        title={copy.home.welcome(user?.fullName ?? '')}
      />
      {user && !user.verified ? (
        <View accessibilityRole="alert" style={styles.verify}>
          <ShieldAlert size={20} color={colors.warning} />
          <View style={styles.verifyText}>
            <Text style={styles.verifyTitle}>{text.verificationTitle}</Text>
            <Text style={styles.verifyBody}>{text.verificationRequired}</Text>
          </View>
        </View>
      ) : null}
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {composing && token ? (
        <TournamentForm
          token={token}
          service={service}
          onCreated={created}
          onCancel={() => setComposing(false)}
        />
      ) : (
        <Button
          label={text.create}
          onPress={() => {
            setNotice('');
            setComposing(true);
          }}
        />
      )}
      <Text accessibilityRole="header" style={styles.section}>
        {text.mineTitle}
      </Text>
      {state.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} secondary onPress={state.retry} />
        </>
      ) : state.data?.length ? (
        <View style={styles.list}>
          {state.data.map(tournament => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              showOrganizer={false}
              onOpen={() => onOpen(tournament.id)}
            />
          ))}
        </View>
      ) : state.data ? (
        <EmptyState
          icon={Medal}
          title={text.mineEmptyTitle}
          body={text.mineEmptyBody}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  verify: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  verifyText: { flex: 1, gap: space.xs },
  verifyTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  verifyBody: { color: colors.secondary, fontSize: 13, lineHeight: 20 },
  notice: { color: colors.success, fontSize: 13, lineHeight: 19 },
  section: { color: colors.text, fontSize: 18, fontWeight: '800' },
  list: { gap: space.md },
});
