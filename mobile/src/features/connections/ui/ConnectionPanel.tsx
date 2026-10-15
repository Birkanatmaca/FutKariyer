import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Handshake } from 'lucide-react-native';
import { Field } from '../../../shared/ui/Field';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { colors, space } from '../../../styles/tokens';
import {
  canRequestConnection,
  connectionMessageLimit,
  messageLength,
  type ConnectionAction,
  type ConnectionRole,
  type ConnectionViewer,
} from '../domain/models';
import type { ConnectionsService } from '../application/connections-service';
import { useConnectionWith } from '../application/useConnectionWith';
import { confirmAction } from './confirm-action';
import {
  ActionButton,
  ConnectionMessage,
  EmailContact,
  cardStyle,
} from './ConnectionParts';

const text = copy.connections;

type Profile = { id: string; name: string; role: ConnectionRole };

// Shown on a discovery profile only where the product rules allow a request.
export function ConnectionPanel({
  token,
  service,
  viewer,
  profile,
}: {
  token: string;
  service: ConnectionsService;
  viewer: ConnectionViewer;
  profile: Profile;
}) {
  if (!canRequestConnection(viewer, profile.role)) return null;
  return (
    <ConnectionPanelContent token={token} service={service} profile={profile} />
  );
}

function ConnectionPanelContent({
  token,
  service,
  profile,
}: {
  token: string;
  service: ConnectionsService;
  profile: Profile;
}) {
  const status = useConnectionWith(service, token, profile.id);
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState('');
  const [lastAction, setLastAction] = useState<ConnectionAction>('accept');
  const length = messageLength(message);
  const tooLong = length > connectionMessageLimit;

  async function send() {
    if (tooLong) return;
    if (await status.send(message)) {
      setComposing(false);
      setMessage('');
    }
  }

  async function respond(action: ConnectionAction) {
    if (action !== 'accept') {
      const confirmed = await confirmAction(
        action === 'decline' ? text.declineTitle : text.cancelTitle,
        action === 'decline'
          ? text.declineBody(profile.name)
          : text.cancelBody(profile.name),
        action === 'decline' ? text.decline : text.cancel,
      );
      if (!confirmed) return;
    }
    setLastAction(action);
    await status.respond(action);
  }

  let body: React.ReactNode = null;
  if (status.loading) {
    body = (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.helper}>{text.stateLoading}</Text>
      </View>
    );
  } else if (status.loadError) {
    body = (
      <>
        <ErrorBanner message={status.loadError} />
        <ActionButton label={copy.form.retry} onPress={status.retry} />
      </>
    );
  } else if (status.state === 'outgoing') {
    body = (
      <>
        <Text style={styles.title}>{text.statusOutgoing}</Text>
        <Text style={styles.helper}>{text.statusOutgoingBody}</Text>
        {status.connection ? (
          <ConnectionMessage connection={status.connection} />
        ) : null}
        <View style={cardStyle.actions}>
          <ActionButton
            label={text.cancel}
            tone="danger"
            loading={status.busy}
            onPress={() => respond('cancel')}
          />
        </View>
      </>
    );
  } else if (status.state === 'incoming') {
    body = (
      <>
        <Text style={styles.title}>{text.statusIncoming}</Text>
        {status.connection ? (
          <ConnectionMessage connection={status.connection} />
        ) : null}
        <View style={cardStyle.actions}>
          <ActionButton
            label={text.accept}
            tone="primary"
            loading={status.busy && lastAction === 'accept'}
            disabled={status.busy}
            onPress={() => respond('accept')}
          />
          <ActionButton
            label={text.decline}
            tone="danger"
            loading={status.busy && lastAction === 'decline'}
            disabled={status.busy}
            onPress={() => respond('decline')}
          />
        </View>
      </>
    );
  } else if (status.state === 'connected') {
    body = (
      <>
        <Text style={styles.title}>{text.statusConnected}</Text>
        {status.connection?.contact ? (
          <EmailContact email={status.connection.contact.email} />
        ) : (
          <Text style={styles.helper}>{text.statusConnectedBody}</Text>
        )}
      </>
    );
  } else if (composing) {
    body = (
      <>
        <Text style={styles.title}>{text.sendTitle}</Text>
        <Field
          label={text.messageLabel}
          placeholder={text.messagePlaceholder}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={connectionMessageLimit * 2}
          error={tooLong ? text.messageTooLong : undefined}
          hint={text.messageCount(length, connectionMessageLimit)}
        />
        {!tooLong ? null : (
          <Text style={styles.helper}>
            {text.messageCount(length, connectionMessageLimit)}
          </Text>
        )}
        <View style={cardStyle.actions}>
          <ActionButton
            label={text.closeForm}
            disabled={status.busy}
            onPress={() => {
              setComposing(false);
              setMessage('');
            }}
          />
          <ActionButton
            label={text.submit}
            tone="primary"
            loading={status.busy}
            disabled={tooLong}
            onPress={send}
          />
        </View>
      </>
    );
  } else {
    body = (
      <>
        <Text style={styles.helper}>{text.sendHint}</Text>
        <ActionButton
          label={text.send}
          tone="primary"
          onPress={() => setComposing(true)}
        />
      </>
    );
  }

  return (
    <View style={cardStyle.card}>
      <View style={styles.heading}>
        <Handshake size={18} color={colors.brand} />
        <Text style={styles.eyebrow}>{text.panelTitle}</Text>
      </View>
      {status.notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {status.notice}
        </Text>
      ) : null}
      {body}
      <ErrorBanner message={status.actionError} />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  eyebrow: { color: colors.brand, fontSize: 12, fontWeight: '800' },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  helper: { color: colors.secondary, fontSize: 13, lineHeight: 20 },
  notice: { color: colors.success, fontSize: 13, fontWeight: '700' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
