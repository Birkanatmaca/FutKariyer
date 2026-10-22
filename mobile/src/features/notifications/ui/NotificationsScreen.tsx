import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { Brand } from '../../../shared/ui/Brand';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import type { AppNotification } from '../domain/models';
import type { NotificationsService } from '../application/notification-service';
import { ConfirmPrompt } from './ConfirmPrompt';
import { NotificationRow } from './NotificationRow';

type NotificationFilter = 'all' | 'unread';
type BulkAction = 'markAllRead' | 'deleteAll' | 'deleteSelected';

export function NotificationsScreen({
  token,
  service,
  onBack,
  onOpenGifts,
  onOpenConnections,
  onOpenStaff,
  onOpenListing,
  onOpenTournament,
  onOpenSquadInvite,
  onOpenProfile,
  onFollowBack,
}: {
  token: string;
  service: NotificationsService;
  onBack?(): void;
  onOpenGifts?(): void;
  onOpenConnections?(): void;
  // Staff notifications open Kulüplerim (coach) or Teknik ekip (club).
  onOpenStaff?(): void;
  onOpenListing?(id: string): void;
  onOpenTournament?(resourceId: string): void;
  // Squad invitations open Kulüp davetleri (player) or Kadrom (club).
  onOpenSquadInvite?(): void;
  // Follow notifications: open the follower's profile and follow them back.
  onOpenProfile?(userId: string, role: AppNotification['actorRole']): void;
  onFollowBack?(userId: string): Promise<void>;
}) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [busyID, setBusyID] = useState('');
  const [busyAll, setBusyAll] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // A long press starts selecting; the delete action then targets only the
  // selected notifications of this page.
  const [selected, setSelected] = useState<string[] | null>(null);
  const [confirm, setConfirm] = useState<BulkAction | null>(null);
  const load = useCallback(
    () => service.list(token, page),
    [service, token, page],
  );
  const state = useFocusedResource(load);
  const items = state.data?.items ?? [];
  // Filtering runs over the loaded page only; the server has no unread-only query.
  const visibleItems =
    filter === 'unread' ? items.filter(item => item.readAt === null) : items;

  async function markRead(id: string) {
    if (busyID || busyAll) return;
    setBusyID(id);
    setError('');
    setNotice('');
    try {
      await service.markRead(token, id);
      state.retry();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusyID('');
    }
  }

  // A tap marks the notification read and opens what it is about.
  function open(item: AppNotification) {
    if (item.readAt === null) markRead(item.id);
    const target = /^[a-f0-9]{32}$/.test(item.resourceId);
    if (item.kind === 'follow' && item.actorRole)
      onOpenProfile?.(item.resourceId, item.actorRole);
    else if (item.kind === 'gift') onOpenGifts?.();
    else if (item.kind === 'connection') onOpenConnections?.();
    else if (item.kind === 'staff') onOpenStaff?.();
    else if (item.kind === 'squad_invite') onOpenSquadInvite?.();
    else if (item.kind === 'opportunity' && target)
      onOpenListing?.(item.resourceId);
    else if (item.kind === 'tournament' && target)
      onOpenTournament?.(item.resourceId);
  }

  function toggle(id: string) {
    setSelected(current => {
      const list = current ?? [];
      const next = list.includes(id)
        ? list.filter(item => item !== id)
        : [...list, id];
      return next.length ? next : null;
    });
  }

  async function runBulk(action: BulkAction) {
    if (busyID || busyAll) return;
    setBusyAll(true);
    setError('');
    setNotice('');
    try {
      if (action === 'markAllRead') {
        await service.markAllRead(token);
        setNotice(copy.notifications.allMarkedRead);
      } else if (action === 'deleteAll') {
        await service.deleteAll(token);
        setNotice(copy.notifications.deleted);
        setPage(1);
      } else if (selected?.length) {
        await service.deleteSelected(token, selected);
        setNotice(copy.notifications.deleted);
      }
      setSelected(null);
      state.retry();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusyAll(false);
      setConfirm(null);
    }
  }

  const selecting = selected !== null;
  const hasItems = !!state.data && state.data.total > 0;
  const prompt = confirm
    ? confirm === 'deleteSelected'
      ? {
          ...copy.notifications.confirm.deleteSelected,
          body: copy.notifications.confirm.deleteSelected.body(
            selected?.length ?? 0,
          ),
          danger: true,
        }
      : {
          ...copy.notifications.confirm[confirm],
          danger: confirm === 'deleteAll',
        }
    : null;

  return (
    <Screen>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.notifications.back}
          onPress={onBack}
          style={styles.back}
        >
          <ArrowLeft size={18} color={colors.text} />
          <Text style={styles.backText}>{copy.notifications.back}</Text>
        </Pressable>
      ) : null}
      <View style={styles.header}>
        <Brand mark={false} />
        <View style={styles.headerActions}>
          {selecting ? (
            <HeaderAction
              icon={X}
              label={copy.notifications.cancelSelection}
              onPress={() => setSelected(null)}
            />
          ) : (
            <HeaderAction
              icon={CheckCheck}
              label={copy.notifications.markAllRead}
              disabled={!state.data?.unreadCount || busyAll || !!busyID}
              onPress={() => setConfirm('markAllRead')}
            />
          )}
          <HeaderAction
            icon={Trash2}
            danger={selecting}
            badge={selected?.length}
            label={
              selecting
                ? copy.notifications.deleteSelected(selected.length)
                : copy.notifications.deleteAll
            }
            disabled={!hasItems || busyAll || !!busyID}
            onPress={() =>
              setConfirm(selecting ? 'deleteSelected' : 'deleteAll')
            }
          />
        </View>
      </View>
      {selecting ? (
        <Text accessibilityRole="alert" style={styles.selection}>
          {copy.notifications.selected(selected.length)}
        </Text>
      ) : null}
      {items.length > 0 && !state.loading && !state.error ? (
        <View
          accessibilityRole="tablist"
          accessibilityLabel={copy.notifications.filterLabel}
          style={styles.filter}
        >
          <FilterTab
            label={copy.notifications.filterAll}
            selected={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <FilterTab
            label={copy.notifications.filterUnread}
            selected={filter === 'unread'}
            onPress={() => setFilter('unread')}
          />
        </View>
      ) : null}
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      {state.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} onPress={state.retry} />
        </>
      ) : visibleItems.length ? (
        <View style={styles.list}>
          {visibleItems.map(item => (
            <NotificationRow
              key={item.id}
              item={item}
              disabled={busyID === item.id || busyAll}
              selecting={selecting}
              selected={!!selected?.includes(item.id)}
              onSelect={() => toggle(item.id)}
              onPress={() => open(item)}
              onFollowBack={
                item.kind === 'follow' && item.actorRole && onFollowBack
                  ? () => onFollowBack(item.resourceId)
                  : undefined
              }
            />
          ))}
        </View>
      ) : items.length ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Bell size={24} color={colors.muted} />
          </View>
          <Text style={styles.emptyTitle}>
            {copy.notifications.emptyUnreadTitle}
          </Text>
          <Text style={styles.emptyBody}>
            {copy.notifications.emptyUnreadBody}
          </Text>
        </View>
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Bell size={24} color={colors.muted} />
          </View>
          <Text style={styles.emptyTitle}>{copy.notifications.emptyTitle}</Text>
          <Text style={styles.emptyBody}>{copy.notifications.emptyBody}</Text>
        </View>
      )}
      {state.data && state.data.totalPages > 1 ? (
        <View style={styles.pagination}>
          <Button
            label={copy.notifications.previous}
            secondary
            disabled={page <= 1 || !!busyID || busyAll}
            onPress={() => setPage(value => value - 1)}
          />
          <Text style={styles.pageText}>
            {copy.notifications.page(page, state.data.totalPages)}
          </Text>
          <Button
            label={copy.notifications.next}
            secondary
            disabled={page >= state.data.totalPages || !!busyID || busyAll}
            onPress={() => setPage(value => value + 1)}
          />
        </View>
      ) : null}
      <ConfirmPrompt
        request={prompt}
        busy={busyAll}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && runBulk(confirm)}
      />
    </Screen>
  );
}

function HeaderAction({
  icon: Icon,
  label,
  onPress,
  disabled,
  danger,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  onPress(): void;
  disabled?: boolean;
  danger?: boolean;
  badge?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerAction,
        danger && styles.headerActionDanger,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Icon
        size={20}
        color={danger ? colors.danger : colors.text}
        strokeWidth={2}
      />
      {badge ? (
        <View style={styles.actionBadge}>
          <Text style={styles.actionBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function FilterTab({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.filterTab, selected && styles.filterTabSelected]}
    >
      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingRight: space.md,
  },
  backText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: { flexDirection: 'row', gap: space.sm },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerActionDanger: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerWash,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  actionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  actionBadgeText: { color: colors.brandInk, fontSize: 10, fontWeight: '800' },
  selection: { color: colors.secondary, fontSize: 13, fontWeight: '600' },
  filter: {
    flexDirection: 'row',
    padding: space.xs,
    gap: space.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  filterTab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  filterTabSelected: { backgroundColor: colors.brand },
  filterText: { color: colors.secondary, fontSize: 13, fontWeight: '700' },
  filterTextSelected: { color: colors.brandInk },
  notice: { color: colors.success, fontSize: 13, lineHeight: 19 },
  list: { gap: space.xs },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  unreadCard: { borderColor: colors.brand, backgroundColor: colors.raised },
  selectedCard: {
    borderColor: colors.brand,
    backgroundColor: colors.brandWash,
  },
  selectedIcon: { backgroundColor: colors.brand },
  cardIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
  },
  cardContent: { flex: 1, gap: space.sm },
  kindLabel: { color: colors.brand, fontSize: 11, fontWeight: '700' },
  kindLabelRead: { color: colors.muted },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  cardBody: { color: colors.secondary, fontSize: 13, lineHeight: 19 },
  date: { color: colors.muted, fontSize: 11 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  markRead: {
    alignSelf: 'flex-start',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
  },
  markReadText: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  readStatus: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  readStatusText: { color: colors.success, fontSize: 12, fontWeight: '600' },
  empty: {
    alignItems: 'center',
    padding: space.xl,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: space.md,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: colors.raised,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  emptyBody: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  pageText: { color: colors.muted, fontSize: 12 },
});
