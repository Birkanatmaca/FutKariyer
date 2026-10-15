import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MapPin,
} from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type {
  EntryStatus,
  Tournament,
  TournamentEntry,
  TournamentStatus,
} from '../domain/models';

const text = copy.tournaments;

// Calendar days stay as written; no time zone conversion is involved.
export const formatDay = (value: string) =>
  value.split('-').reverse().join('.');

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('tr-TR');

export const tournamentDates = (tournament: Tournament) =>
  text.dates(formatDay(tournament.startsOn), formatDay(tournament.endsOn));

export const eligibleLabel = (tournament: Tournament) =>
  tournament.eligibleTypes.map(type => text.teamTypes[type]).join(', ');

export function StatusBadge({
  status,
}: {
  status: TournamentStatus | EntryStatus;
}) {
  const highlighted = status === 'open' || status === 'accepted';
  const danger = status === 'cancelled' || status === 'rejected';
  const label =
    status in text.status
      ? text.status[status as TournamentStatus]
      : text.entryStatus[status as EntryStatus];
  return (
    <View
      style={[
        styles.badge,
        highlighted && styles.badgeOn,
        danger && styles.badgeDanger,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          highlighted && styles.badgeTextOn,
          danger && styles.badgeTextDanger,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// Selectable chip used for the format segments and the team type choices.
export function Chip({
  label,
  selected,
  disabled,
  multi,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  multi?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TournamentCard({
  tournament,
  showOrganizer,
  onOpen,
}: {
  tournament: Tournament;
  showOrganizer: boolean;
  onOpen(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tournament.name}
      accessibilityHint={text.open}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text numberOfLines={2} style={styles.title}>
            {tournament.name}
          </Text>
          <StatusBadge status={tournament.status} />
        </View>
        {showOrganizer ? (
          <Text numberOfLines={1} style={styles.organizer}>
            {text.organizer(tournament.organizerName)}
          </Text>
        ) : null}
        <Text style={styles.format}>
          {text.formats[tournament.format]} · {eligibleLabel(tournament)}
        </Text>
        <View style={styles.metaRow}>
          <CalendarDays size={13} color={colors.muted} />
          <Text style={styles.meta}>
            {tournamentDates(tournament)} ·{' '}
            {text.deadline(formatDay(tournament.applicationDeadline))}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <MapPin size={13} color={colors.muted} />
          <Text style={styles.meta}>
            {tournament.district || text.noDistrict}
          </Text>
        </View>
        <Text style={styles.count}>
          {text.teams(tournament.acceptedTeams, tournament.teamCapacity)}
          {showOrganizer ? '' : ' · ' + text.pending(tournament.pendingEntries)}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

export type EntryAction = {
  label: string;
  danger?: boolean;
  onPress(): void;
};

// Shows one entry with an expandable roster. The title is the club for the
// organizer and the tournament for the club.
export function EntryCard({
  entry,
  title,
  subtitle,
  busy,
  disabled,
  actions = [],
}: {
  entry: TournamentEntry;
  title: string;
  subtitle: string;
  busy: boolean;
  disabled: boolean;
  actions?: EntryAction[];
}) {
  const [expanded, setExpanded] = useState(false);
  const Toggle = expanded ? ChevronUp : ChevronDown;
  return (
    <View style={styles.entry}>
      <View style={styles.cardTop}>
        <Text numberOfLines={2} style={styles.title}>
          {title}
        </Text>
        <StatusBadge status={entry.status} />
      </View>
      <Text style={styles.organizer}>{subtitle}</Text>
      {entry.message ? (
        <Text style={styles.message}>{entry.message}</Text>
      ) : null}
      <Text style={styles.meta}>
        {text.appliedAt(formatDate(entry.createdAt))}
        {entry.decidedAt
          ? ' · ' + text.decidedAt(formatDate(entry.decidedAt))
          : ''}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          (expanded ? text.hideRoster : text.showRoster) + ': ' + title
        }
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(value => !value)}
        style={styles.rosterToggle}
      >
        <Text style={styles.rosterToggleText}>
          {(expanded ? text.hideRoster : text.showRoster) +
            ' · ' +
            text.players(entry.players.length)}
        </Text>
        <Toggle size={16} color={colors.secondary} />
      </Pressable>
      {expanded ? (
        <View style={styles.roster}>
          {entry.players.length ? (
            entry.players.map(player => (
              <View key={player.id} style={styles.rosterRow}>
                <Text style={styles.player}>{player.name}</Text>
                <Text style={styles.position}>
                  {player.position || text.noPosition}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.meta}>{text.rosterNone}</Text>
          )}
        </View>
      ) : null}
      {actions.length ? (
        <View style={styles.actions}>
          {actions.map(action => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label + ': ' + title}
              accessibilityState={{ disabled: disabled || busy, busy }}
              disabled={disabled || busy}
              onPress={action.onPress}
              style={[
                styles.action,
                action.danger ? styles.actionDanger : styles.actionPrimary,
                (disabled || busy) && styles.disabled,
              ]}
            >
              {busy ? (
                <ActivityIndicator
                  size="small"
                  color={action.danger ? colors.danger : colors.brand}
                />
              ) : null}
              <Text
                style={[
                  styles.actionText,
                  action.danger && styles.actionTextDanger,
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeOn: { borderColor: colors.brand, backgroundColor: colors.brandWash },
  badgeDanger: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerWash,
  },
  badgeText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  badgeTextOn: { color: colors.brand },
  badgeTextDanger: { color: colors.danger },
  chip: {
    minHeight: 40,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandWash,
  },
  chipText: { color: colors.secondary, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: colors.brand },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.raised },
  cardBody: { flex: 1, gap: space.xs },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  title: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
  organizer: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  format: { color: colors.brand, fontSize: 13, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  count: { color: colors.text, fontSize: 12, fontWeight: '700' },
  entry: {
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  message: { color: colors.secondary, fontSize: 13, lineHeight: 20 },
  rosterToggle: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
  },
  rosterToggleText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  roster: { gap: space.xs },
  rosterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  player: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
  position: { color: colors.muted, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  action: {
    minHeight: 42,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    gap: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    backgroundColor: colors.raised,
  },
  actionPrimary: { borderColor: colors.brand },
  actionDanger: { borderColor: colors.dangerWash },
  actionText: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  actionTextDanger: { color: colors.danger },
  disabled: { opacity: 0.45 },
});
