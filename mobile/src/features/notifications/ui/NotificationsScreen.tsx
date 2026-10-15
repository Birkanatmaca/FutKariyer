import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  CreditCard,
  Gift,
  Handshake,
  Medal,
  Newspaper,
  Sparkles,
  Trophy,
} from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import type {
  AppNotification,
  DisplayNotificationKind,
} from '../domain/models';
import type { NotificationsService } from '../application/notification-service';

type NotificationFilter = 'all' | 'unread';

const kindIcon: Record<DisplayNotificationKind, typeof Bell> = {
  team_application: Bell,
  payment: CreditCard,
  opportunity: Sparkles,
  gift: Gift,
  game_reward: Trophy,
  news_review: Newspaper,
  connection: Handshake,
  tournament: Medal,
  other: Bell,
};

export function NotificationsScreen({
  token,
  service,
  onBack,
  onOpenGifts,
  onOpenConnections,
  onOpenListing,
  onOpenTournament,
}: {
  token: string;
  service: NotificationsService;
  onBack(): void;
  onOpenGifts?(): void;
  onOpenConnections?(): void;
  onOpenListing?(id: string): void;
  onOpenTournament?(resourceId: string): void;
}) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [busyID, setBusyID] = useState('');
  const [busyAll, setBusyAll] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(() => service.list(token, page), [service, token, page]);
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
      setNotice(copy.notifications.markedRead);
      state.retry();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : copy.form.unexpected);
    } finally {
      setBusyID('');
    }
  }

  async function markAllRead() {
    if (busyID || busyAll || !state.data?.unreadCount) return;
    setBusyAll(true);
    setError('');
    setNotice('');
    try {
      await service.markAllRead(token);
      setNotice(copy.notifications.allMarkedRead);
      state.retry();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : copy.form.unexpected);
    } finally {
      setBusyAll(false);
    }
  }

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.notifications.back}
        onPress={onBack}
        style={styles.back}
      >
        <ArrowLeft size={18} color={colors.text} />
        <Text style={styles.backText}>{copy.notifications.back}</Text>
      </Pressable>
      <PageHeader
        eyebrow={copy.notifications.eyebrow}
        title={copy.notifications.title}
        hint={copy.notifications.description}
      />
      {state.data?.unreadCount ? (
        <View style={styles.unreadSummary}>
          <View style={styles.unreadIcon}>
            <Bell size={19} color={colors.brand} />
          </View>
          <Text style={styles.unreadText}>
            {copy.notifications.unread(state.data.unreadCount)}
          </Text>
          <Button
            label={copy.notifications.markAllRead}
            secondary
            loading={busyAll}
            disabled={!!busyID}
            onPress={markAllRead}
          />
        </View>
      ) : state.data && state.data.total > 0 ? (
        <Text style={styles.readSummary}>{copy.notifications.allRead}</Text>
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
            <NotificationCard
              key={item.id}
              item={item}
              busy={busyID === item.id}
              disabled={!!busyID || busyAll}
              onMarkRead={() => markRead(item.id)}
              onOpenGifts={onOpenGifts}
              onOpenConnections={onOpenConnections}
              onOpenListing={onOpenListing}
              onOpenTournament={onOpenTournament}
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
    </Screen>
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

function NotificationCard({
  item,
  busy,
  disabled,
  onMarkRead,
  onOpenGifts,
  onOpenConnections,
  onOpenListing,
  onOpenTournament,
}: {
  item: AppNotification;
  busy: boolean;
  disabled: boolean;
  onMarkRead(): void;
  onOpenGifts?(): void;
  onOpenConnections?(): void;
  onOpenListing?(id: string): void;
  onOpenTournament?(resourceId: string): void;
}) {
  const read = item.readAt !== null;
  const Icon = kindIcon[item.kind];
  const opensGifts = item.kind === 'gift' && !!onOpenGifts;
  const opensConnections =
    item.kind === 'connection' && !!onOpenConnections;
  // Opportunity notifications may point at a club listing; the caller decides
  // whether the listing is still open, otherwise tapping only marks it read.
  const opensListing =
    item.kind === 'opportunity' &&
    /^[a-f0-9]{32}$/.test(item.resourceId) &&
    !!onOpenListing;
  // Tournament notifications carry a tournament id or an entry id; the caller
  // resolves which screen to open.
  const opensTournament =
    item.kind === 'tournament' &&
    /^[a-f0-9]{32}$/.test(item.resourceId) &&
    !!onOpenTournament;
  const actionable =
    !read || opensGifts || opensConnections || opensListing || opensTournament;
  const date = new Date(item.createdAt).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  // Tapping marks an unread notification as read; gift and connection notifications also open their screen.
  function open() {
    if (!read) onMarkRead();
    if (opensGifts) onOpenGifts?.();
    if (opensConnections) onOpenConnections?.();
    if (opensListing) onOpenListing?.(item.resourceId);
    if (opensTournament) onOpenTournament?.(item.resourceId);
  }
  return (
    <Pressable
      accessibilityRole={actionable ? 'button' : undefined}
      accessibilityLabel={item.title}
      accessibilityState={{ disabled: disabled || busy || !actionable, busy }}
      disabled={disabled || busy || !actionable}
      onPress={open}
      style={[styles.card, !read && styles.unreadCard]}
    >
      <View style={styles.cardIcon}>
        <Icon size={19} color={read ? colors.muted : colors.brand} />
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.kindLabel, read && styles.kindLabelRead]}>
          {copy.notifications.kinds[item.kind]}
        </Text>
        <View style={styles.cardHeading}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          {!read ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text style={styles.cardBody}>{item.body}</Text>
        <Text style={styles.date}>{date}</Text>
        {read ? (
          <View style={styles.readStatus}>
            <Check size={14} color={colors.success} />
            <Text style={styles.readStatusText}>{copy.notifications.read}</Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.notifications.markRead}
            accessibilityState={{ disabled: disabled || busy, busy }}
            disabled={disabled || busy}
            onPress={onMarkRead}
            style={styles.markRead}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : (
              <>
                <CheckCheck size={15} color={colors.brand} />
                <Text style={styles.markReadText}>{copy.notifications.markRead}</Text>
              </>
            )}
          </Pressable>
        )}
        {opensGifts ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.notifications.openGifts}
            accessibilityState={{ disabled: disabled || busy, busy }}
            disabled={disabled || busy}
            onPress={open}
            style={styles.markRead}
          >
            <Gift size={15} color={colors.brand} />
            <Text style={styles.markReadText}>
              {copy.notifications.openGifts}
            </Text>
          </Pressable>
        ) : null}
        {opensConnections ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.notifications.openConnections}
            accessibilityState={{ disabled: disabled || busy, busy }}
            disabled={disabled || busy}
            onPress={open}
            style={styles.markRead}
          >
            <Handshake size={15} color={colors.brand} />
            <Text style={styles.markReadText}>
              {copy.notifications.openConnections}
            </Text>
          </Pressable>
        ) : null}
      </View>
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
  unreadSummary: {
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: space.md,
  },
  unreadIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
  },
  unreadText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  readSummary: { color: colors.success, fontSize: 13, fontWeight: '700' },
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
  list: { gap: space.md },
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
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
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
  emptyBody: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  pageText: { color: colors.muted, fontSize: 12 },
});
