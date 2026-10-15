import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Compass,
  ClipboardList,
  Bell,
  MessagesSquare,
  ShoppingBag,
  Settings,
  UserRound,
  Newspaper,
  Gift,
  Medal,
  Megaphone,
  Shield,
  Users,
  Eye,
} from 'lucide-react-native';
import { Screen } from '../shared/ui/Screen';
import { PageHeader } from '../shared/ui/PageHeader';
import { copy } from '../shared/lib/copy';
import { colors, radius, space } from '../styles/tokens';

export function MoreScreen({
  onSettings,
  onDiscover,
  onConnections,
  onProfile,
  onTeamRequests,
  onMyTeamApplications,
  onBuyTeamRights,
  onNotifications,
  onNews,
  onGifts,
  onSquad,
  onClubListings,
  onListings,
  onMemberships,
  onTournaments,
  onTournamentEntries,
  onVisitors,
  unreadCount,
  isClub,
  isPlayer,
  isOrganizer = false,
}: {
  onSettings(): void;
  onDiscover(): void;
  onConnections(): void;
  onProfile(): void;
  onTeamRequests(): void;
  onMyTeamApplications(): void;
  onBuyTeamRights(): void;
  onNotifications(): void;
  onNews(): void;
  onGifts(): void;
  onSquad(): void;
  onClubListings(): void;
  onListings(): void;
  onMemberships(): void;
  onTournaments(): void;
  onTournamentEntries(): void;
  onVisitors(): void;
  unreadCount: number | null;
  isClub: boolean;
  isPlayer: boolean;
  // Organizers only see account, notifications, news and tournaments; the
  // other entries open player or club features the server rejects for them.
  isOrganizer?: boolean;
}) {
  const entries = [
    {
      title: copy.more.profile,
      hint: copy.more.profileHint,
      icon: UserRound,
      onPress: onProfile,
    },
    {
      title: copy.more.settings,
      hint: copy.more.settingsHint,
      icon: Settings,
      onPress: onSettings,
    },
    {
      title: copy.more.notifications,
      hint: copy.more.notificationsHint,
      icon: Bell,
      onPress: onNotifications,
      badge: unreadCount,
    },
    {
      title: copy.more.news,
      hint: copy.more.newsHint,
      icon: Newspaper,
      onPress: onNews,
    },
    {
      title: copy.more.gifts,
      hint: copy.more.giftsHint,
      icon: Gift,
      onPress: onGifts,
    },
    {
      title: copy.more.visitors,
      hint: copy.more.visitorsHint,
      icon: Eye,
      onPress: onVisitors,
    },
    {
      title: copy.more.discover,
      hint: copy.more.discoverHint,
      icon: Compass,
      onPress: onDiscover,
    },
    {
      title: copy.more.connections,
      hint: copy.more.connectionsHint,
      icon: MessagesSquare,
      onPress: onConnections,
    },
    ...(isClub
      ? [
          {
            title: copy.more.teamRequests,
            hint: copy.more.teamRequestsHint,
            icon: ClipboardList,
            onPress: onTeamRequests,
          },
          {
            title: copy.more.squad,
            hint: copy.more.squadHint,
            icon: Users,
            onPress: onSquad,
          },
          {
            title: copy.more.clubListings,
            hint: copy.more.clubListingsHint,
            icon: Megaphone,
            onPress: onClubListings,
          },
          {
            title: copy.more.tournaments,
            hint: copy.more.tournamentsHint,
            icon: Medal,
            onPress: onTournaments,
          },
          {
            title: copy.more.tournamentEntries,
            hint: copy.more.tournamentEntriesHint,
            icon: ClipboardList,
            onPress: onTournamentEntries,
          },
        ]
      : [
          {
            title: copy.more.listings,
            hint: copy.more.listingsHint,
            icon: Megaphone,
            onPress: onListings,
          },
        ]),
    ...(isPlayer
      ? [
          {
            title: copy.more.buyTeamRights,
            hint: copy.more.buyTeamRightsHint,
            icon: ShoppingBag,
            onPress: onBuyTeamRights,
          },
          {
            title: copy.more.myTeamApplications,
            hint: copy.more.myTeamApplicationsHint,
            icon: ClipboardList,
            onPress: onMyTeamApplications,
          },
          {
            title: copy.more.memberships,
            hint: copy.more.membershipsHint,
            icon: Shield,
            onPress: onMemberships,
          },
        ]
      : []),
    ...(isClub
      ? []
      : [
          {
            title: copy.more.tournaments,
            hint: copy.more.tournamentsHint,
            icon: Medal,
            onPress: onTournaments,
          },
        ]),
  ];
  const organizerTitles: string[] = [
    copy.more.settings,
    copy.more.notifications,
    copy.more.news,
    copy.more.tournaments,
  ];
  const visible = isOrganizer
    ? entries.filter(entry => organizerTitles.includes(entry.title))
    : entries;
  return (
    <Screen>
      <PageHeader
        eyebrow={copy.more.eyebrow}
        title={copy.more.title}
        hint={copy.more.description}
      />
      <View style={styles.grid}>
        {rows(visible).map(row => (
          <View key={row[0].title} style={styles.row}>
            {row.map(({ title, hint, icon: Icon, onPress, badge }) => (
              <Pressable
                key={title}
                accessibilityRole="button"
                accessibilityLabel={
                  badge ? title + ', ' + copy.more.unread(badge) : title
                }
                accessibilityHint={hint}
                onPress={onPress}
                style={({ pressed }) => [
                  styles.tile,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.icon}>
                  <Icon size={24} color={colors.brand} strokeWidth={2} />
                  {badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {badge > 99 ? '99+' : badge}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={2} style={styles.title}>
                  {title}
                </Text>
              </Pressable>
            ))}
            {Array.from({ length: columns - row.length }, (_, i) => (
              <View key={'spacer' + i} style={styles.spacer} />
            ))}
          </View>
        ))}
      </View>
    </Screen>
  );
}
// Three icon tiles per row: one word each, the explanation lives in the accessibility hint.
const columns = 3;
function rows<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    out.push(items.slice(i, i + columns));
  }
  return out;
}
const styles = StyleSheet.create({
  grid: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  spacer: { flex: 1 },
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.raised, transform: [{ scale: 0.97 }] },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandSoft,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { color: colors.text, fontSize: 10, fontWeight: '800' },
});
