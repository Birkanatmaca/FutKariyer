import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowRight, MapPin, RefreshCw, Shield } from 'lucide-react-native';
import { useAuth } from '../../auth';
import { Screen } from '../../../shared/ui/Screen';
import { Brand } from '../../../shared/ui/Brand';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import type { Team } from '../domain/models';
import { createTeamsService } from '../application/teams-service';
import { teamsRepository } from '../data/http-teams-repository';
import { TeamDetailScreen } from './TeamDetailScreen';
import { RightsBadge } from './RightsBadge';
import { useRightsBalance } from '../application/useRightsBalance';

const service = createTeamsService(teamsRepository);

export function TeamsScreen({
  onOpenRights,
  open,
}: {
  // Opens the team application rights screen from the header badge (players only).
  onOpenRights?(): void;
  // Opens one team's page, e.g. from a search result; `at` makes a repeat open of the same team count.
  open?: { id: string; at: number };
} = {}) {
  const { token, user } = useAuth();
  const balance = useRightsBalance(
    service,
    token,
    user?.role === 'player' && !!onOpenRights,
  );
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Team | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (open) setOpenId(open.id);
  }, [open]);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const load = useCallback(
    () =>
      token
        ? service.list(token, page, query)
        : Promise.reject(new Error(copy.playerProfile.sessionError)),
    [token, page, query],
  );
  const state = useFocusedResource(load);
  if ((openId || selected) && token)
    return (
      <TeamDetailScreen
        token={token}
        id={openId ?? selected?.id ?? ''}
        onBack={() => {
          setOpenId(null);
          setSelected(null);
        }}
      />
    );
  return (
    <Screen>
      <Brand mark={false} />
      <PageHeader
        eyebrow={copy.teams.eyebrow}
        title={copy.teams.title}
        hint={copy.teams.description}
        accessory={
          balance !== null && onOpenRights ? (
            <RightsBadge count={balance} onPress={onOpenRights} />
          ) : null
        }
      />
      <TextInput
        accessibilityLabel={copy.teams.search}
        placeholder={copy.teams.search}
        placeholderTextColor={colors.muted}
        value={search}
        onChangeText={value => {
          setSearch(value);
          setPage(1);
        }}
        style={styles.search}
        returnKeyType="search"
      />
      {state.loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.helper}>{copy.teams.loading}</Text>
        </View>
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} onPress={state.retry} />
        </>
      ) : state.data ? (
        <>
          <View style={styles.resultHeader}>
            <Text style={styles.helper}>
              {copy.teams.results(state.data.total)}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={state.retry}
              style={styles.refresh}
            >
              <RefreshCw size={15} color={colors.secondary} />
              <Text style={styles.helper}>{copy.teams.refresh}</Text>
            </Pressable>
          </View>
          {state.data.items.length ? (
            state.data.items.map(team => (
              <TeamCard
                key={team.id}
                team={team}
                onPress={() => setSelected(team)}
              />
            ))
          ) : (
            <EmptyState
              icon={Shield}
              title={copy.teams.emptyTitle}
              body={copy.teams.emptyBody}
            />
          )}
          {(state.data.totalPages > 1 || page > 1) && (
            <View style={styles.pagination}>
              <PageButton
                label={copy.leagues.previous}
                disabled={page <= 1}
                onPress={() => setPage(value => value - 1)}
              />
              <Text style={styles.helper}>
                {copy.leagues.page(page, state.data.totalPages)}
              </Text>
              <PageButton
                label={copy.leagues.next}
                disabled={page >= state.data.totalPages}
                onPress={() => setPage(value => value + 1)}
              />
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

function TeamCard({ team, onPress }: { team: Team; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.teams.detail + ': ' + team.name}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardIcon}>
        <Shield size={22} color={colors.brand} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{team.name}</Text>
        {team.footballType !== 'unknown' ? (
          <Text style={styles.type}>
            {copy.football.types[team.footballType]}
          </Text>
        ) : null}
        {team.district ? (
          <View style={styles.location}>
            <MapPin size={13} color={colors.secondary} />
            <Text numberOfLines={1} style={styles.helper}>
              {team.district}
            </Text>
          </View>
        ) : null}
        {team.description ? (
          <Text numberOfLines={2} style={styles.description}>
            {team.description}
          </Text>
        ) : null}
      </View>
      <ArrowRight color={colors.muted} size={19} />
    </Pressable>
  );
}

function PageButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.pageButton, disabled && styles.disabled]}
    >
      <Text style={styles.pageText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: space.lg,
    fontSize: 14,
  },
  loading: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  helper: { color: colors.secondary, fontSize: 12 },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refresh: {
    minHeight: 40,
    paddingHorizontal: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    padding: space.lg,
    gap: space.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1, minWidth: 0, gap: space.xs },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  type: { color: colors.brand, fontSize: 11, fontWeight: '700' },
  location: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  description: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  pageButton: {
    minHeight: 44,
    minWidth: 82,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.82 },
});
