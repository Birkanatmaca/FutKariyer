import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Bell,
  Check,
  CreditCard,
  Gift,
  Handshake,
  Medal,
  Newspaper,
  Sparkles,
  Trophy,
  UserPlus,
  type LucideIcon,
} from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type {
  AppNotification,
  DisplayNotificationKind,
} from '../domain/models';

const kindIcon: Record<DisplayNotificationKind, LucideIcon> = {
  team_application: Bell,
  payment: CreditCard,
  opportunity: Sparkles,
  gift: Gift,
  game_reward: Trophy,
  news_review: Newspaper,
  connection: Handshake,
  tournament: Medal,
  follow: UserPlus,
  other: Bell,
};

// Short relative time: "şimdi", "5 dk", "3 sa", "2 g", then the date.
export function relativeTime(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  const text = copy.notifications.time;
  if (minutes < 1) return text.now;
  if (minutes < 60) return text.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return text.hours(hours);
  const days = Math.floor(hours / 24);
  if (days < 7) return text.days(days);
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
  });
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => Array.from(word)[0] ?? '')
    .join('')
    .toLocaleUpperCase('tr-TR');
}

// One minimal notification line: avatar, text, time and, for a new follower,
// a follow-back pill. The whole row opens what the notification is about.
export function NotificationRow({
  item,
  disabled,
  selecting,
  selected,
  onPress,
  onSelect,
  onFollowBack,
}: {
  item: AppNotification;
  disabled: boolean;
  selecting: boolean;
  selected: boolean;
  onPress(): void;
  onSelect(): void;
  onFollowBack?(): Promise<void>;
}) {
  const unread = item.readAt === null;
  const follow = item.kind === 'follow';
  const Icon = kindIcon[item.kind];
  const [following, setFollowing] = useState(!!item.followingBack);
  const [busy, setBusy] = useState(false);
  async function followBack() {
    if (!onFollowBack || busy || following) return;
    setBusy(true);
    try {
      await onFollowBack();
      setFollowing(true);
    } catch {
      // The row keeps offering the action; the screen stays usable.
    } finally {
      setBusy(false);
    }
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title + ', ' + item.body}
      accessibilityHint={selecting ? undefined : copy.notifications.selectHint}
      accessibilityState={{
        disabled,
        selected: selecting ? selected : undefined,
      }}
      disabled={disabled}
      onPress={selecting ? onSelect : onPress}
      // Kept defined while selecting so the release after the long press
      // that started selecting is not taken as a tap.
      onLongPress={onSelect}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.row,
        unread && styles.unread,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.avatar,
          follow && styles.personAvatar,
          selected && styles.selectedAvatar,
        ]}
      >
        {selected ? (
          <Check size={20} color={colors.brandInk} strokeWidth={3} />
        ) : follow ? (
          <Text style={styles.initials}>{initials(item.title)}</Text>
        ) : (
          <Icon size={19} color={unread ? colors.brand : colors.secondary} />
        )}
        {follow && !selected ? (
          <View style={styles.kindBadge}>
            <UserPlus size={10} color={colors.brandInk} strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <View style={styles.content}>
        {follow ? (
          <Text numberOfLines={2} style={styles.body}>
            <Text style={styles.title}>{item.title}</Text> {item.body}
          </Text>
        ) : (
          <>
            <Text numberOfLines={1} style={styles.title}>
              {item.title}
            </Text>
            <Text numberOfLines={2} style={styles.body}>
              {item.body}
            </Text>
          </>
        )}
        <Text style={[styles.time, unread && styles.timeUnread]}>
          {relativeTime(item.createdAt)}
        </Text>
      </View>
      {follow && onFollowBack && !selecting ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            following
              ? copy.notifications.followingBack
              : copy.notifications.followBack(item.title)
          }
          accessibilityState={{ disabled: following || busy, busy }}
          disabled={following || busy}
          hitSlop={6}
          onPress={followBack}
          style={[styles.pill, following && styles.pillDone]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.brandInk} />
          ) : (
            <Text style={[styles.pillText, following && styles.pillTextDone]}>
              {following
                ? copy.notifications.followingBack
                : copy.notifications.followBackShort}
            </Text>
          )}
        </Pressable>
      ) : unread && !selecting ? (
        <View style={styles.dot} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.transparent,
  },
  unread: { backgroundColor: colors.surface },
  selected: { borderColor: colors.brand, backgroundColor: colors.brandWash },
  pressed: { opacity: 0.8 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  personAvatar: { backgroundColor: colors.overlay },
  selectedAvatar: { backgroundColor: colors.brand },
  initials: { color: colors.text, fontSize: 15, fontWeight: '800' },
  kindBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  content: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  body: { color: colors.secondary, fontSize: 13, lineHeight: 18 },
  time: { color: colors.muted, fontSize: 11, marginTop: 2 },
  timeUnread: { color: colors.brand, fontWeight: '600' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  pill: {
    minWidth: 92,
    minHeight: 34,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  pillDone: {
    backgroundColor: colors.transparent,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: { color: colors.brandInk, fontSize: 12, fontWeight: '800' },
  pillTextDone: { color: colors.secondary },
});
