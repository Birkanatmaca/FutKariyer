import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AnkaraTeamPicker,
  type AnkaraTeamChoice,
  type FootballService,
} from '../../football';
import { ApiError } from '../../../shared/api/client';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, space, type } from '../../../styles/tokens';
import type { ClubService } from '../application/club-service';
import { SectionStatus } from './ClubPrimitives';

// The club picks its own team in the TFF Ankara standings (20 Oct 2026). The
// server checks the team is in that group's table before saving the link.
export function ClubTffLinkScreen({
  token,
  service,
  footballService,
  onBack,
}: {
  token: string;
  service: ClubService;
  footballService: FootballService;
  onBack(): void;
}) {
  const text = copy.clubProfile;
  const load = useCallback(() => service.profile(token), [service, token]);
  const state = useFocusedResource(load);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function pick(choice: AnkaraTeamChoice) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await service.setTff(token, choice);
      onBack();
    } catch (failure) {
      const field =
        failure instanceof ApiError
          ? Object.values(failure.fields ?? {})[0]
          : '';
      setError(
        field ||
          (failure instanceof Error ? failure.message : copy.form.unexpected),
      );
      setBusy(false);
    }
  }
  const link = state.data?.tff;
  return (
    <Screen>
      <TopBar title={text.tffScreenTitle} onBack={onBack} />
      <Text style={styles.body}>{text.tffScreenBody}</Text>
      <SectionStatus
        loading={state.loading}
        error={state.error}
        onRetry={state.retry}
      />
      {error ? <ErrorBanner message={error} /> : null}
      {state.data ? (
        <View>
          <AnkaraTeamPicker
            service={footballService}
            token={token}
            initial={
              link
                ? {
                    season: link.season,
                    league: link.league,
                    group: link.group,
                    team: link.team,
                  }
                : undefined
            }
            busy={busy}
            onPick={pick}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...type.body, color: colors.secondary, marginBottom: space.sm },
});
