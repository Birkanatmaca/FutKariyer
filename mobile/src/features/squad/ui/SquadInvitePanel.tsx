import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Search, Send } from 'lucide-react-native';
import { confirmAction } from '../../connections';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Field } from '../../../shared/ui/Field';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import type { SquadService } from '../application/squad-service';
import {
  isInviteSearch,
  inviteMessageError,
} from '../application/invite-validation';
import {
  splitClubInvites,
  squadInviteLimits,
  type PlayerCandidate,
  type SquadInvite,
} from '../domain/models';
import { formatDate } from './SquadParts';

const text = copy.squad;
const errorText = (failure: unknown) =>
  failure instanceof Error && failure.message
    ? failure.message
    : copy.form.unexpected;

// Kadrom: invite discoverable players, see open invitations (with cancel)
// and the ones answered in the last 30 days.
export function SquadInvitePanel({
  token,
  service,
}: {
  token: string;
  service: SquadService;
}) {
  const invites = useFocusedResource(
    useCallback(() => service.clubInvites(token), [service, token]),
  );
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<PlayerCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [messageError, setMessageError] = useState('');
  const ready = isInviteSearch(query);
  const lists = splitClubInvites(invites.data ?? []);

  async function search() {
    if (!ready || searching) return;
    Keyboard.dismiss();
    setSearching(true);
    setError('');
    try {
      setResults(await service.candidates(token, query));
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setSearching(false);
    }
  }

  async function invite(player: PlayerCandidate) {
    if (busyId) return;
    const invalid = inviteMessageError(message);
    if (invalid) {
      setMessageError(invalid);
      return;
    }
    setBusyId(player.id);
    setError('');
    setNotice('');
    try {
      await service.invite(token, player.id, message);
      setResults(current =>
        current ? current.filter(item => item.id !== player.id) : current,
      );
      setMessage('');
      setNotice(text.invited(player.name));
      invites.retry();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusyId('');
    }
  }

  async function cancel(item: SquadInvite) {
    if (busyId) return;
    const confirmed = await confirmAction(
      text.cancelInviteTitle,
      text.cancelInviteBody(item.playerName),
      text.cancelInvite,
    );
    if (!confirmed) return;
    setBusyId(item.id);
    setError('');
    setNotice('');
    try {
      await service.cancelInvite(token, item.id);
      setNotice(text.inviteCancelled(item.playerName));
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusyId('');
      invites.retry();
    }
  }

  return (
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.title}>
        {text.inviteTitle}
      </Text>
      <Text style={styles.help}>{text.inviteHelp}</Text>
      <Field
        label={text.inviteSearch}
        icon={Search}
        value={query}
        onChangeText={value => {
          setQuery(value);
          setResults(null);
        }}
        onSubmitEditing={search}
        returnKeyType="search"
        autoCapitalize="words"
        maxLength={squadInviteLimits.search.max}
        hint={ready ? undefined : text.inviteSearchHint}
      />
      <Button
        label={text.searchButton}
        secondary
        loading={searching}
        disabled={!ready}
        onPress={search}
      />
      <Field
        label={text.inviteMessage}
        value={message}
        onChangeText={value => {
          setMessage(value);
          setMessageError('');
        }}
        multiline
        error={messageError}
        hint={
          Array.from(message.trim()).length + ' / ' + squadInviteLimits.message
        }
      />
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      <ErrorBanner message={error} />
      {results === null ? null : results.length ? (
        <View style={styles.list}>
          {results.map(player => (
            <View key={player.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text numberOfLines={1} style={styles.name}>
                  {player.name}
                </Text>
                <Text numberOfLines={1} style={styles.meta}>
                  {player.position || text.noPosition}
                </Text>
              </View>
              <RowAction
                label={text.invite}
                target={player.name}
                busy={busyId === player.id}
                disabled={!!busyId}
                onPress={() => invite(player)}
              />
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.help}>{text.inviteNone}</Text>
      )}
      <Text accessibilityRole="header" style={styles.subtitle}>
        {text.openInvites}
      </Text>
      {invites.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : invites.error ? (
        <>
          <ErrorBanner message={invites.error} />
          <Button label={copy.form.retry} secondary onPress={invites.retry} />
        </>
      ) : lists.open.length ? (
        <View style={styles.list}>
          {lists.open.map(item => (
            <View key={item.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text numberOfLines={1} style={styles.name}>
                  {item.playerName}
                </Text>
                <Text numberOfLines={1} style={styles.meta}>
                  {(item.position || text.noPosition) +
                    ' · ' +
                    text.invitedAt(formatDate(item.createdAt))}
                </Text>
              </View>
              <RowAction
                label={text.cancelInvite}
                target={item.playerName}
                danger
                busy={busyId === item.id}
                disabled={!!busyId}
                onPress={() => cancel(item)}
              />
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.help}>{text.invitesEmpty}</Text>
      )}
      {lists.answered.length ? (
        <>
          <Text accessibilityRole="header" style={styles.subtitle}>
            {text.answeredInvites}
          </Text>
          <View style={styles.list}>
            {lists.answered.map(item => (
              <View key={item.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text numberOfLines={1} style={styles.name}>
                    {item.playerName}
                  </Text>
                  <Text numberOfLines={1} style={styles.meta}>
                    {text.inviteStatus[item.status] +
                      (item.decidedAt
                        ? ' · ' + text.answeredAt(formatDate(item.decidedAt))
                        : '')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function RowAction({
  label,
  target,
  danger,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  target: string;
  danger?: boolean;
  busy: boolean;
  disabled: boolean;
  onPress(): void;
}) {
  const tint = danger ? colors.danger : colors.brand;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label + ': ' + target}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        danger ? styles.actionDanger : styles.actionPrimary,
        disabled && styles.disabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={tint} />
      ) : danger ? null : (
        <Send size={14} color={tint} />
      )}
      <Text style={[styles.actionText, danger && styles.actionTextDanger]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  subtitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: space.sm,
  },
  help: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  notice: { color: colors.success, fontSize: 13, lineHeight: 19 },
  list: { gap: space.sm },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 12 },
  action: {
    minHeight: 40,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  actionPrimary: { borderColor: colors.brand },
  actionDanger: { borderColor: colors.dangerWash },
  actionText: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  actionTextDanger: { color: colors.danger },
  disabled: { opacity: 0.45 },
});
