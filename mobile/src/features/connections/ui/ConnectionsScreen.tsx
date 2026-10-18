import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Handshake, Inbox, Send } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { TopBar } from '../../../shared/ui/TopBar';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { Connection, ConnectionAction } from '../domain/models';
import type { ConnectionsService } from '../application/connections-service';
import { useConnections } from '../application/useConnections';
import { confirmAction } from './confirm-action';
import {
  ActionButton,
  ConnectionMessage,
  EmailContact,
  PartyHeader,
  cardStyle,
} from './ConnectionParts';

type Segment = 'incoming' | 'outgoing' | 'accepted';

const text = copy.connections;
const empty = {
  incoming: {
    icon: Inbox,
    title: text.emptyIncomingTitle,
    body: text.emptyIncomingBody,
  },
  outgoing: {
    icon: Send,
    title: text.emptyOutgoingTitle,
    body: text.emptyOutgoingBody,
  },
  accepted: {
    icon: Handshake,
    title: text.emptyAcceptedTitle,
    body: text.emptyAcceptedBody,
  },
};

export function ConnectionsScreen({
  token,
  service,
  onDiscover,
  onBack,
}: {
  token: string;
  service: ConnectionsService;
  onDiscover(): void;
  onBack?(): void;
}) {
  const [segment, setSegment] = useState<Segment>('incoming');
  const [lastAction, setLastAction] = useState<ConnectionAction>('accept');
  const connections = useConnections(service, token);
  const items = connections.inbox?.[segment] ?? [];

  async function respond(item: Connection, action: ConnectionAction) {
    if (action === 'decline' || action === 'cancel') {
      const confirmed = await confirmAction(
        action === 'decline' ? text.declineTitle : text.cancelTitle,
        action === 'decline'
          ? text.declineBody(item.other.name)
          : text.cancelBody(item.other.name),
        action === 'decline' ? text.decline : text.cancel,
      );
      if (!confirmed) return;
    }
    setLastAction(action);
    await connections.respond(item.id, action);
  }

  return (
    <Screen>
      <TopBar title={text.title} onBack={onBack} />
      <View
        accessibilityRole="tablist"
        accessibilityLabel={text.segmentsLabel}
        style={styles.segments}
      >
        {(['incoming', 'outgoing', 'accepted'] as const).map(key => {
          const selected = segment === key;
          const label = text.segment(
            text[key],
            connections.inbox?.[key].length ?? null,
          );
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={() => setSegment(key)}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.segmentText,
                  selected && styles.segmentTextSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {connections.notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {connections.notice}
        </Text>
      ) : null}
      <ErrorBanner message={connections.error} />
      {connections.loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>{text.loading}</Text>
        </View>
      ) : connections.loadFailed ? (
        <Button label={copy.form.retry} onPress={connections.retry} />
      ) : items.length ? (
        <View style={styles.list}>
          {items.map(item => (
            <ConnectionItem
              key={item.id}
              item={item}
              segment={segment}
              busyAction={connections.busyId === item.id ? lastAction : null}
              disabled={!!connections.busyId}
              onRespond={action => respond(item, action)}
            />
          ))}
        </View>
      ) : (
        <>
          <EmptyState
            icon={empty[segment].icon}
            title={empty[segment].title}
            body={empty[segment].body}
          />
          {segment !== 'incoming' ? (
            <Button label={text.button} onPress={onDiscover} secondary />
          ) : null}
        </>
      )}
    </Screen>
  );
}

function ConnectionItem({
  item,
  segment,
  busyAction,
  disabled,
  onRespond,
}: {
  item: Connection;
  segment: Segment;
  busyAction: ConnectionAction | null;
  disabled: boolean;
  onRespond(action: ConnectionAction): void;
}) {
  return (
    <View style={cardStyle.card}>
      <PartyHeader party={item.other} />
      {segment === 'accepted' ? (
        item.contact ? (
          <EmailContact email={item.contact.email} />
        ) : null
      ) : (
        <ConnectionMessage connection={item} />
      )}
      {segment === 'incoming' ? (
        <View style={cardStyle.actions}>
          <ActionButton
            label={text.accept}
            tone="primary"
            loading={busyAction === 'accept'}
            disabled={disabled}
            onPress={() => onRespond('accept')}
          />
          <ActionButton
            label={text.decline}
            tone="danger"
            loading={busyAction === 'decline'}
            disabled={disabled}
            onPress={() => onRespond('decline')}
          />
        </View>
      ) : segment === 'outgoing' ? (
        <View style={cardStyle.actions}>
          <ActionButton
            label={text.cancel}
            tone="danger"
            loading={busyAction === 'cancel'}
            disabled={disabled}
            onPress={() => onRespond('cancel')}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    padding: space.xs,
    gap: space.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  segmentSelected: { backgroundColor: colors.brand },
  segmentText: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  segmentTextSelected: { color: colors.brandInk },
  notice: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  loading: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  loadingText: { color: colors.secondary, fontSize: 13 },
  list: { gap: space.md },
});
