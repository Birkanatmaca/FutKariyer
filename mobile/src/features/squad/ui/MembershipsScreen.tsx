import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Shield } from 'lucide-react-native';
import { confirmAction } from '../../connections';
import { BackLink } from '../../../shared/ui/BackLink';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Screen } from '../../../shared/ui/Screen';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, space } from '../../../styles/tokens';
import type { SquadService } from '../application/squad-service';
import { useSquadAction } from '../application/useSquadAction';
import type { Membership } from '../domain/models';
import { formatDate, RosterCard } from './SquadParts';

const text = copy.squad;

export function MembershipsScreen({
  token,
  service,
  onBack,
}: {
  token: string;
  service: SquadService;
  onBack(): void;
}) {
  const state = useFocusedResource(
    useCallback(() => service.memberships(token), [service, token]),
  );
  const action = useSquadAction(state.retry);

  async function leave(membership: Membership) {
    const confirmed = await confirmAction(
      text.leaveTitle,
      text.leaveBody(membership.clubName),
      text.leave,
    );
    if (!confirmed) return;
    await action.run(
      membership.clubId,
      () => service.leaveClub(token, membership.clubId),
      text.left(membership.clubName),
    );
  }

  return (
    <Screen>
      <BackLink label={copy.form.back} onPress={onBack} />
      <PageHeader
        eyebrow={text.membershipsEyebrow}
        title={text.membershipsTitle}
        hint={text.membershipsDescription}
      />
      {action.notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {action.notice}
        </Text>
      ) : null}
      <ErrorBanner message={action.error} />
      {state.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} onPress={state.retry} />
        </>
      ) : state.data?.length ? (
        <View style={styles.list}>
          {state.data.map(membership => (
            <RosterCard
              key={membership.clubId}
              title={membership.clubName}
              lines={[
                membership.district || text.noDistrict,
                text.joinedAt(formatDate(membership.joinedAt)),
              ]}
              actionLabel={text.leave}
              busy={action.busyId === membership.clubId}
              disabled={!!action.busyId}
              onAction={() => leave(membership)}
            />
          ))}
        </View>
      ) : state.data ? (
        <EmptyState
          icon={Shield}
          title={text.membershipsEmptyTitle}
          body={text.membershipsEmptyBody}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  notice: { color: colors.success, fontSize: 13, lineHeight: 19 },
});
