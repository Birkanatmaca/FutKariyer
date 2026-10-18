import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, ClipboardList, RefreshCw, X } from 'lucide-react-native';
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

const service = createTeamsService(teamsRepository);
type Filter = 'pending' | 'all' | 'accepted' | 'rejected';

export function TeamJoinRequestsScreen({
  token,
  onBack,
}: {
  token: string;
  onBack(): void;
}) {
  const [filter, setFilter] = useState<Filter>('pending');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');
  const load = useCallback(
    () => service.requests(token, filter, page),
    [token, filter, page],
  );
  const state = useFocusedResource(load);
  async function decide(id: string, decision: 'accepted' | 'rejected') {
    if (busyId) return;
    setBusyId(id);
    setActionError('');
    try {
      await service.decide(token, id, decision);
      state.retry();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : copy.form.unexpected,
      );
    } finally {
      setBusyId('');
    }
  }
  return (
    <Screen>
      <TopBar
        title={copy.teams.requestsTitle}
        onBack={onBack}
        backLabel={copy.teams.requestsBack}
      />
      <View style={styles.filters}>
        {(['pending', 'all', 'accepted', 'rejected'] as Filter[]).map(value => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === value }}
            onPress={() => {
              setFilter(value);
              setPage(1);
            }}
            style={[styles.filter, filter === value && styles.filterSelected]}
          >
            <Text
              style={[
                styles.filterText,
                filter === value && styles.filterTextSelected,
              ]}
            >
              {copy.teams.filters[value]}
            </Text>
          </Pressable>
        ))}
      </View>
      {state.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} onPress={state.retry} />
        </>
      ) : state.data ? (
        <>
          {actionError ? <ErrorBanner message={actionError} /> : null}
          <View style={styles.resultHeader}>
            <Text style={styles.helper}>
              {copy.teams.requestResults(state.data.total)}
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
            state.data.items.map(item => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.name}>
                    {item.playerName || copy.teams.unknownPlayer}
                  </Text>
                  <Text
                    style={[
                      styles.status,
                      item.status === 'pending'
                        ? styles.status_pending
                        : item.status === 'accepted'
                        ? styles.status_accepted
                        : styles.status_rejected,
                    ]}
                  >
                    {copy.teams.status[item.status]}
                  </Text>
                </View>
                <Text style={styles.helper}>
                  {copy.teams.receivedAt(
                    new Date(item.createdAt).toLocaleDateString('tr-TR'),
                  )}
                </Text>
                {item.status === 'pending' ? (
                  <View style={styles.actions}>
                    <SmallButton
                      label={copy.teams.accept}
                      icon="check"
                      disabled={!!busyId}
                      onPress={() => decide(item.id, 'accepted')}
                    />
                    <SmallButton
                      label={copy.teams.reject}
                      icon="x"
                      disabled={!!busyId}
                      danger
                      onPress={() => decide(item.id, 'rejected')}
                    />
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <EmptyState
              icon={ClipboardList}
              title={copy.teams.requestsEmptyTitle}
              body={copy.teams.requestsEmptyBody}
            />
          )}
          {state.data.totalPages > 1 || page > 1 ? (
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
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function SmallButton({
  label,
  icon,
  disabled,
  danger,
  onPress,
}: {
  label: string;
  icon: 'check' | 'x';
  disabled: boolean;
  danger?: boolean;
  onPress(): void;
}) {
  const Icon = icon === 'check' ? Check : X;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        danger && styles.danger,
        disabled && styles.disabled,
      ]}
    >
      <Icon size={15} color={danger ? colors.danger : colors.success} />
      <Text style={[styles.actionText, danger && styles.dangerText]}>
        {label}
      </Text>
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
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  filter: {
    minHeight: 38,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandWash,
  },
  filterText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  filterTextSelected: { color: colors.brand },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18 },
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
  status_pending: { color: colors.brand },
  status_accepted: { color: colors.success },
  status_rejected: { color: colors.danger },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  action: {
    minHeight: 42,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    gap: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: { color: colors.success, fontSize: 12, fontWeight: '700' },
  danger: { borderColor: colors.dangerWash },
  dangerText: { color: colors.danger },
  disabled: { opacity: 0.45 },
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
});
