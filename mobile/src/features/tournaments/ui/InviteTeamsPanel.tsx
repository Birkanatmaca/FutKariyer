import React, { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Search, Send } from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Field } from '../../../shared/ui/Field';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { TournamentsService } from '../application/tournaments-service';
import {
  errorMessage,
  isSearchQuery,
  textLength,
} from '../application/validation';
import { tournamentLimits, type InviteCandidate } from '../domain/models';

const text = copy.tournaments;

// Organizer: find clubs of an eligible type and invite them with an
// optional message.
export function InviteTeamsPanel({
  token,
  tournamentId,
  service,
  onInvited,
}: {
  token: string;
  tournamentId: string;
  service: TournamentsService;
  onInvited(notice: string): void;
}) {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<InviteCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [messageError, setMessageError] = useState('');
  const ready = isSearchQuery(query);

  async function search() {
    if (!ready || searching) return;
    Keyboard.dismiss();
    setSearching(true);
    setError('');
    try {
      setResults(await service.candidates(token, tournamentId, query));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSearching(false);
    }
  }

  async function invite(club: InviteCandidate) {
    if (busyId) return;
    if (textLength(message) > tournamentLimits.message) {
      setMessageError(text.tooLong(tournamentLimits.message));
      return;
    }
    setBusyId(club.id);
    setError('');
    try {
      await service.invite(token, tournamentId, club.id, message);
      setResults(current =>
        current ? current.filter(item => item.id !== club.id) : current,
      );
      setMessage('');
      onInvited(text.invited(club.name));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusyId('');
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
        maxLength={tournamentLimits.search.max}
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
        hint={text.counter(textLength(message), tournamentLimits.message)}
      />
      <ErrorBanner message={error} />
      {results === null ? null : results.length ? (
        <View style={styles.list}>
          {results.map(club => (
            <View key={club.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text numberOfLines={1} style={styles.name}>
                  {club.name}
                </Text>
                <Text numberOfLines={1} style={styles.meta}>
                  {(club.district || text.noDistrict) +
                    (club.footballType !== 'unknown'
                      ? ' · ' + copy.football.types[club.footballType]
                      : '')}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text.invite + ': ' + club.name}
                accessibilityState={{
                  disabled: !!busyId,
                  busy: busyId === club.id,
                }}
                disabled={!!busyId}
                onPress={() => invite(club)}
                style={[styles.action, !!busyId && styles.disabled]}
              >
                {busyId === club.id ? (
                  <ActivityIndicator size="small" color={colors.brand} />
                ) : (
                  <Send size={14} color={colors.brand} />
                )}
                <Text style={styles.actionText}>{text.invite}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.help}>{text.inviteNone}</Text>
      )}
    </View>
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
  help: { color: colors.muted, fontSize: 12, lineHeight: 18 },
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
    borderColor: colors.brand,
  },
  actionText: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
