import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ArrowUpRight,
  ClipboardCheck,
  ClipboardList,
  Megaphone,
  Newspaper,
  PenLine,
  Trophy,
  UserSearch,
  UsersRound,
  type LucideIcon,
} from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { ContentService } from '../../content';
import { HomeNews } from '../../content';
import { ClubSection, SectionStatus, sessionError } from './ClubPrimitives';

export function ClubNewsSection({
  token,
  service,
  onNews,
  onCompose,
  onMine,
}: {
  token: string | null;
  service: ContentService;
  onNews(id?: string): void;
  onCompose?(): void;
  onMine?(): void;
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
      {/* Two slim buttons side by side instead of two full-width ones. */}
      {onCompose || onMine ? (
        <View style={styles.newsActions}>
          {onCompose ? (
            <SlimButton
              icon={PenLine}
              label={copy.clubHome.newsWrite}
              primary
              onPress={onCompose}
            />
          ) : null}
          {onMine ? (
            <SlimButton
              icon={Newspaper}
              label={copy.clubHome.newsMine}
              onPress={onMine}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function SlimButton({
  icon: Icon,
  label,
  primary,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  primary?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.slim,
        primary && styles.slimPrimary,
        pressed && styles.pressed,
      ]}
    >
      <Icon
        size={15}
        color={primary ? colors.brandInk : colors.text}
        strokeWidth={2.4}
      />
      <Text style={[styles.slimText, primary && styles.slimTextPrimary]}>
        {label}
      </Text>
    </Pressable>
  );
}

type QuickAction = {
  key: string;
  icon: LucideIcon;
  tint: string;
  wash: string;
  title: string;
  hint: string;
  count?: number;
  onPress(): void;
};

// Rectangular shortcuts to the club's tools (20 Oct 2026), two per row. A
// switched coach only sees the tools the club gave them.
export function ClubQuickActions({
  pendingApplications,
  onApplications,
  onDiscover,
  onSquad,
  onListings,
  onTournaments,
  onEntries,
}: {
  // Undefined while the club center loads.
  pendingApplications?: number;
  onApplications?(): void;
  onDiscover(): void;
  onSquad?(): void;
  onListings?(): void;
  onTournaments(): void;
  onEntries?(): void;
}) {
  const text = copy.clubHome.quick;
  const all: (Omit<QuickAction, 'onPress'> & { onPress?(): void })[] = [
    {
      key: 'applications',
      icon: ClipboardList,
      tint: colors.brand,
      wash: colors.brandWash,
      title: text.applications,
      hint: text.applicationsHint(pendingApplications),
      count: pendingApplications,
      onPress: onApplications,
    },
    {
      key: 'discover',
      icon: UserSearch,
      tint: colors.accent,
      wash: colors.accentWash,
      title: text.discover,
      hint: text.discoverHint,
      onPress: onDiscover,
    },
    {
      key: 'squad',
      icon: UsersRound,
      tint: colors.info,
      wash: colors.infoWash,
      title: text.squad,
      hint: text.squadHint,
      onPress: onSquad,
    },
    {
      key: 'listings',
      icon: Megaphone,
      tint: colors.warning,
      wash: colors.overlay,
      title: text.listings,
      hint: text.listingsHint,
      onPress: onListings,
    },
    {
      key: 'tournaments',
      icon: Trophy,
      tint: colors.success,
      wash: colors.overlay,
      title: text.tournaments,
      hint: text.tournamentsHint,
      onPress: onTournaments,
    },
    {
      key: 'entries',
      icon: ClipboardCheck,
      tint: colors.accent,
      wash: colors.accentWash,
      title: text.entries,
      hint: text.entriesHint,
      onPress: onEntries,
    },
  ];
  const actions = all.filter((item): item is QuickAction => !!item.onPress);
  const rows: QuickAction[][] = [];
  for (let i = 0; i < actions.length; i += 2)
    rows.push(actions.slice(i, i + 2));
  return (
    <ClubSection title={text.title}>
      <View style={styles.grid}>
        {rows.map(row => (
          <View key={row[0].key} style={styles.row}>
            {row.map(item => (
              <QuickTile key={item.key} item={item} />
            ))}
            {row.length === 1 ? <View style={styles.spacer} /> : null}
          </View>
        ))}
      </View>
    </ClubSection>
  );
}

function QuickTile({ item }: { item: QuickAction }) {
  const { icon: Icon, tint, wash, title, hint, count } = item;
  const waiting = !!count;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
      onPress={item.onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.tileTop}>
        <View style={[styles.icon, { backgroundColor: wash }]}>
          <Icon size={18} color={tint} strokeWidth={2.2} />
        </View>
        {waiting ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {count > 99 ? '99+' : String(count)}
            </Text>
          </View>
        ) : (
          <ArrowUpRight size={16} color={colors.muted} />
        )}
      </View>
      <View style={styles.tileText}>
        <Text numberOfLines={1} style={styles.tileTitle}>
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.tileHint, waiting && { color: tint }]}
        >
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  pressed: { opacity: 0.75 },
  newsActions: { flexDirection: 'row', gap: space.sm },
  slim: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.raised,
  },
  slimPrimary: { backgroundColor: colors.brand, borderColor: colors.brand },
  slimText: {
    ...type.caption,
    fontSize: 13,
    color: colors.text,
    fontWeight: '700',
  },
  slimTextPrimary: { color: colors.brandInk },
  grid: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  spacer: { flex: 1 },
  tile: {
    flex: 1,
    minHeight: 112,
    justifyContent: 'space-between',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  badgeText: {
    ...type.number,
    fontSize: 12,
    fontWeight: '800',
    color: colors.brandInk,
  },
  tileText: { gap: 2 },
  tileTitle: { ...type.body, color: colors.text, fontWeight: '700' },
  tileHint: { ...type.caption, color: colors.muted },
});
