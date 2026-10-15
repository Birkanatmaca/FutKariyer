import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import type { TeamJoinRequest } from '../../teams';
import type { DiscoveryProfile, DiscoveryQuery } from '../../discovery';
import type { DiscoveryService } from '../../discovery';
import type { ContentService } from '../../content';
import { HomeNews } from '../../content';
import type { TeamsService } from '../../teams';
import type { ClubService } from '../application/club-service';
import {
  clubStyles,
  ClubSection,
  EmptyText,
  SectionStatus,
  sessionError,
} from './ClubPrimitives';

// Every section fetches its own data and handles its own loading, error and empty states.
const previewQuery: DiscoveryQuery = {
  kind: 'players',
  search: '',
  position: '',
  dominantFoot: '',
  availability: '',
  footballType: '',
  licenseStatus: '',
  page: 1,
};

export function ClubProfileSection({
  token,
  service,
  onEdit,
}: {
  token: string | null;
  service: ClubService;
  onEdit(): void;
}) {
  const state = useFocusedResource(
    useCallback(
      () => (token ? service.profile(token) : sessionError()),
      [service, token],
    ),
  );
  const profile = state.data;
  return (
    <ClubSection title={copy.clubHome.profileTitle}>
      <SectionStatus
        loading={state.loading}
        error={state.error}
        onRetry={state.retry}
      />
      {profile ? (
        <View style={clubStyles.card}>
          <Text accessibilityRole="header" style={styles.clubName}>
            {profile.name}
          </Text>
          <Text style={styles.meta}>
            {copy.football.types[profile.footballType]} ·{' '}
            {profile.district || copy.clubHome.noDistrict}
          </Text>
          <Text numberOfLines={3} style={styles.body}>
            {profile.description || copy.clubHome.noDescription}
          </Text>
        </View>
      ) : null}
      <Button label={copy.clubHome.profileEdit} secondary onPress={onEdit} />
    </ClubSection>
  );
}

export function ClubNewsSection({
  token,
  service,
  onNews,
  onCompose,
  onMine,
}: {
  token: string | null;
  service: ContentService;
  onNews(): void;
  onCompose(): void;
  onMine(): void;
}) {
  const state = useFocusedResource(
    useCallback(
      () => (token ? service.news(token, 1) : sessionError()),
      [service, token],
    ),
  );
  return (
    <View style={styles.stack}>
      <SectionStatus
        loading={state.loading}
        error={state.error}
        onRetry={state.retry}
      />
      {state.data ? (
        <HomeNews
          items={state.data.items.slice(0, 3)}
          imageUrl={service.imageUrl}
          onNews={onNews}
        />
      ) : null}
      <Button label={copy.clubHome.newsWrite} onPress={onCompose} />
      <Button label={copy.clubHome.newsMine} secondary onPress={onMine} />
    </View>
  );
}

export function ClubPlayersSection({
  token,
  teamsService,
  discoveryService,
  onDiscover,
}: {
  token: string | null;
  teamsService: TeamsService;
  discoveryService: DiscoveryService;
  onDiscover(): void;
}) {
  return (
    <ClubSection title={copy.clubHome.playersTitle}>
      <PendingApplications token={token} service={teamsService} />
      <PlayerDiscoveryPreview
        token={token}
        service={discoveryService}
        onAll={onDiscover}
      />
    </ClubSection>
  );
}

// Entry points only; the squad and listing screens load their own data.
export function ClubSquadSection({
  onSquad,
  onListings,
}: {
  onSquad(): void;
  onListings(): void;
}) {
  return (
    <ClubSection title={copy.clubHome.squadTitle}>
      <Button label={copy.clubHome.squadOpen} secondary onPress={onSquad} />
      <Button
        label={copy.clubHome.listingsOpen}
        secondary
        onPress={onListings}
      />
    </ClubSection>
  );
}

export function ClubTournamentsSection({
  onTournaments,
  onEntries,
}: {
  onTournaments(): void;
  onEntries(): void;
}) {
  return (
    <ClubSection title={copy.clubHome.tournamentsTitle}>
      <Button
        label={copy.clubHome.tournamentsOpen}
        secondary
        onPress={onTournaments}
      />
      <Button
        label={copy.clubHome.tournamentEntriesOpen}
        secondary
        onPress={onEntries}
      />
    </ClubSection>
  );
}

function PendingApplications({
  token,
  service,
}: {
  token: string | null;
  service: TeamsService;
}) {
  const state = useFocusedResource(
    useCallback(
      () => (token ? service.requests(token, 'pending', 1) : sessionError()),
      [service, token],
    ),
  );
  const [busyId, setBusyId] = useState('');
  const [rejectingId, setRejectingId] = useState('');
  const [error, setError] = useState('');
  async function decide(id: string, decision: 'accepted' | 'rejected') {
    if (!token || busyId) return;
    setBusyId(id);
    setError('');
    try {
      await service.decide(token, id, decision);
      setRejectingId('');
      state.retry();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.clubHome.decideFailed,
      );
    } finally {
      setBusyId('');
    }
  }
  return (
    <ClubSection title={copy.clubHome.applicationsTitle}>
      <SectionStatus
        loading={state.loading}
        error={state.error}
        onRetry={state.retry}
      />
      {error ? <ErrorBanner message={error} /> : null}
      {state.data ? (
        <>
          <Text style={styles.count}>
            {copy.clubHome.applicationsCount(state.data.total)}
          </Text>
          {state.data.items.length ? (
            state.data.items
              .slice(0, 3)
              .map(item => (
                <ApplicationRow
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  disabled={!!busyId}
                  rejecting={rejectingId === item.id}
                  onAccept={() => decide(item.id, 'accepted')}
                  onAskReject={() => setRejectingId(item.id)}
                  onCancelReject={() => setRejectingId('')}
                  onConfirmReject={() => decide(item.id, 'rejected')}
                />
              ))
          ) : (
            <EmptyText>{copy.clubHome.applicationsEmpty}</EmptyText>
          )}
        </>
      ) : null}
    </ClubSection>
  );
}

function ApplicationRow({
  item,
  busy,
  disabled,
  rejecting,
  onAccept,
  onAskReject,
  onCancelReject,
  onConfirmReject,
}: {
  item: TeamJoinRequest;
  busy: boolean;
  disabled: boolean;
  rejecting: boolean;
  onAccept(): void;
  onAskReject(): void;
  onCancelReject(): void;
  onConfirmReject(): void;
}) {
  return (
    <View style={clubStyles.card}>
      <Text numberOfLines={1} style={styles.rowTitle}>
        {item.playerName || copy.teams.unknownPlayer}
      </Text>
      <Text style={styles.meta}>
        {copy.teams.receivedAt(
          new Date(item.createdAt).toLocaleDateString('tr-TR'),
        )}
      </Text>
      {rejecting ? (
        <>
          <Text style={styles.meta}>{copy.clubHome.rejectConfirm}</Text>
          <View style={styles.actions}>
            <SmallButton
              label={copy.clubHome.rejectConfirmYes}
              danger
              busy={busy}
              disabled={disabled}
              onPress={onConfirmReject}
            />
            <SmallButton
              label={copy.profile.cancel}
              disabled={disabled}
              onPress={onCancelReject}
            />
          </View>
        </>
      ) : (
        <View style={styles.actions}>
          <SmallButton
            label={copy.teams.accept}
            busy={busy}
            disabled={disabled}
            onPress={onAccept}
          />
          <SmallButton
            label={copy.teams.reject}
            danger
            disabled={disabled}
            onPress={onAskReject}
          />
        </View>
      )}
    </View>
  );
}

function PlayerDiscoveryPreview({
  token,
  service,
  onAll,
}: {
  token: string | null;
  service: DiscoveryService;
  onAll(): void;
}) {
  const state = useFocusedResource(
    useCallback(
      () => (token ? service.list(token, previewQuery) : sessionError()),
      [service, token],
    ),
  );
  return (
    <ClubSection
      title={copy.clubHome.discoveryTitle}
      action={{ label: copy.clubHome.viewAll, onPress: onAll }}
    >
      <SectionStatus
        loading={state.loading}
        error={state.error}
        onRetry={state.retry}
      />
      {state.data ? (
        state.data.items.length ? (
          <View style={styles.list}>
            {state.data.items.slice(0, 3).map(profile => (
              <PlayerRow key={profile.id} profile={profile} />
            ))}
          </View>
        ) : (
          <EmptyText>{copy.clubHome.discoveryEmpty}</EmptyText>
        )
      ) : null}
    </ClubSection>
  );
}

function PlayerRow({ profile }: { profile: DiscoveryProfile }) {
  return (
    <View style={clubStyles.card}>
      <Text numberOfLines={1} style={styles.rowTitle}>
        {profile.fullName}
      </Text>
      <Text style={styles.meta}>
        {profile.playerProfile?.position || copy.discover.noPosition} ·{' '}
        {profile.district || copy.clubHome.noDistrict}
      </Text>
    </View>
  );
}

function SmallButton({
  label,
  busy,
  disabled,
  danger,
  onPress,
}: {
  label: string;
  busy?: boolean;
  disabled: boolean;
  danger?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || !!busy, busy: !!busy }}
      disabled={disabled || !!busy}
      onPress={onPress}
      style={[
        styles.action,
        danger && styles.actionDanger,
        (disabled || busy) && styles.disabled,
      ]}
    >
      {danger ? null : <Check size={15} color={colors.success} />}
      <Text style={[styles.actionText, danger && styles.actionTextDanger]}>
        {busy ? copy.clubHome.loading : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  clubName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  body: { color: colors.secondary, fontSize: 13, lineHeight: 20 },
  count: { color: colors.brand, fontSize: 13, fontWeight: '700' },
  list: { gap: space.sm },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
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
    borderColor: colors.border,
    backgroundColor: colors.raised,
  },
  actionDanger: { borderColor: colors.dangerWash },
  actionText: { color: colors.success, fontSize: 12, fontWeight: '700' },
  actionTextDanger: { color: colors.danger },
  disabled: { opacity: 0.45 },
});
