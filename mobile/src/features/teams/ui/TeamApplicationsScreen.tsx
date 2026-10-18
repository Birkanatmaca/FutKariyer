import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ArrowRight,
  ClipboardList,
  MapPin,
  RefreshCw,
} from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import { createTeamsService } from '../application/teams-service';
import { teamsRepository } from '../data/http-teams-repository';
import { TeamDetailScreen } from './TeamDetailScreen';

const service = createTeamsService(teamsRepository);

export function TeamApplicationsScreen({
  token,
  onBack,
}: {
  token: string;
  onBack(): void;
}) {
  const [page, setPage] = useState(1);
  const [selectedTeam, setSelectedTeam] = useState('');
  const load = useCallback(
    () => service.applications(token, page),
    [token, page],
  );
  const state = useFocusedResource(load);
  if (selectedTeam) {
    return (
      <TeamDetailScreen
        token={token}
        id={selectedTeam}
        onBack={() => setSelectedTeam('')}
      />
    );
  }
  return (
    <Screen>
      <TopBar
        title={copy.teams.applicationsTitle}
        onBack={onBack}
        backLabel={copy.teams.applicationsBack}
      />
      {state.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} onPress={state.retry} />
        </>
      ) : state.data ? (
        <>
          <View style={styles.quota}>
            <Text style={styles.quotaTitle}>{copy.teams.quotaTitle}</Text>
            <Text style={styles.quotaCount}>
              {copy.teams.quota(
                state.data.quota.remaining,
                state.data.quota.limit,
              )}
            </Text>
            <Text style={styles.helper}>
              {copy.teams.quotaHistory(
                state.data.quota.used,
                state.data.quota.limit,
              )}
            </Text>
            <Text style={styles.helper}>
              {copy.teams.purchasedQuota(state.data.quota.purchased)}
            </Text>
            <Text style={styles.helper}>
              {copy.teams.earnedQuota(state.data.quota.earned)}
            </Text>
            {state.data.quota.pro > 0 ? (
              <Text style={styles.helper}>
                {copy.teams.proQuota(state.data.quota.pro)}
              </Text>
            ) : null}
          </View>
          <View style={styles.resultHeader}>
            <Text style={styles.helper}>
              {copy.teams.requestResults(state.data.total)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.teams.refresh}
              onPress={state.retry}
              style={styles.refresh}
            >
              <RefreshCw size={15} color={colors.secondary} />
              <Text style={styles.helper}>{copy.teams.refresh}</Text>
            </Pressable>
          </View>
          {state.data.items.length ? (
            state.data.items.map(item => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.name}>{item.teamName}</Text>
                  <Text
                    style={[
                      styles.status,
                      item.status === 'pending'
                        ? styles.statusPending
                        : item.status === 'accepted'
                        ? styles.statusAccepted
                        : styles.statusRejected,
                    ]}
                  >
                    {copy.teams.status[item.status]}
                  </Text>
                </View>
                {item.teamDistrict ? (
                  <View style={styles.location}>
                    <MapPin size={13} color={colors.secondary} />
                    <Text style={styles.helper}>{item.teamDistrict}</Text>
                  </View>
                ) : null}
                <Text style={styles.helper}>
                  {copy.teams.sentAt(
                    new Date(item.createdAt).toLocaleDateString('tr-TR'),
                  )}
                </Text>
                {item.status !== 'pending' ? (
                  <Text style={styles.helper}>
                    {copy.teams.answeredAt(
                      new Date(item.updatedAt).toLocaleDateString('tr-TR'),
                    )}
                  </Text>
                ) : null}
                {item.teamAvailable ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      copy.teams.openAppliedTeam + ': ' + item.teamName
                    }
                    onPress={() => setSelectedTeam(item.teamId)}
                    style={({ pressed }) => [
                      styles.openTeam,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.openTeamText}>
                      {copy.teams.openAppliedTeam}
                    </Text>
                    <ArrowRight size={16} color={colors.brand} />
                  </Pressable>
                ) : (
                  <Text style={styles.unavailable}>
                    {copy.teams.appliedTeamUnavailable}
                  </Text>
                )}
              </View>
            ))
          ) : (
            <EmptyState
              icon={ClipboardList}
              title={copy.teams.applicationsEmptyTitle}
              body={copy.teams.applicationsEmptyBody}
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
  quota: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
    padding: space.lg,
    gap: space.xs,
  },
  quotaTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  quotaCount: { color: colors.brand, fontSize: 20, fontWeight: '800' },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: space.lg,
    gap: space.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  status: { fontSize: 11, fontWeight: '700' },
  statusPending: { color: colors.brand },
  statusAccepted: { color: colors.success },
  statusRejected: { color: colors.danger },
  location: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  openTeam: {
    minHeight: 42,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
  },
  openTeamText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  unavailable: { color: colors.muted, fontSize: 12, lineHeight: 18 },
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
