import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Users } from 'lucide-react-native';
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
import type { SquadMember } from '../domain/models';
import { formatDate, RosterCard } from './SquadParts';

const text = copy.squad;

export function SquadScreen({
  token,
  service,
  onBack,
}: {
  token: string;
  service: SquadService;
  onBack(): void;
}) {
  const state = useFocusedResource(
    useCallback(() => service.squad(token), [service, token]),
  );
  const action = useSquadAction(state.retry);

  async function remove(member: SquadMember) {
    const confirmed = await confirmAction(
      text.removeTitle,
      text.removeBody(member.name),
      text.remove,
    );
    if (!confirmed) return;
    await action.run(
      member.playerId,
      () => service.removeMember(token, member.playerId),
      text.removed(member.name),
    );
  }

  return (
    <Screen>
      <BackLink label={copy.form.back} onPress={onBack} />
      <PageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        hint={text.description}
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
          <Text style={styles.count}>{text.count(state.data.length)}</Text>
          {state.data.map(member => (
            <RosterCard
              key={member.playerId}
              title={member.name}
              lines={[
                (member.position || text.noPosition) +
                  ' · ' +
                  copy.football.types[member.footballType],
                text.joinedAt(formatDate(member.joinedAt)),
              ]}
              actionLabel={text.remove}
              busy={action.busyId === member.playerId}
              disabled={!!action.busyId}
              onAction={() => remove(member)}
            />
          ))}
        </View>
      ) : state.data ? (
        <EmptyState
          icon={Users}
          title={text.emptyTitle}
          body={text.emptyBody}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  count: { color: colors.brand, fontSize: 13, fontWeight: '700' },
  notice: { color: colors.success, fontSize: 13, lineHeight: 19 },
});
