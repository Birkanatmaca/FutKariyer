import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ChevronRight,
  Compass,
  ClipboardList,
  MessagesSquare,
  ShoppingBag,
  Settings,
  Newspaper,
  Gift,
  Medal,
  Megaphone,
  Shield,
  Users,
  Eye,
  type LucideIcon,
} from 'lucide-react-native';
import { Screen } from '../shared/ui/Screen';
import { Brand } from '../shared/ui/Brand';
import { copy } from '../shared/lib/copy';
import { colors, radius, space } from '../styles/tokens';

type Entry = {
  title: string;
  hint: string;
  icon: LucideIcon;
  onPress(): void;
};
type Section = { title: string; entries: Entry[] };

export function MoreScreen({
  onSettings,
  onDiscover,
  onConnections,
  onTeamRequests,
  onMyTeamApplications,
  onBuyTeamRights,
  onNews,
  onGifts,
  onSquad,
  onClubListings,
  onListings,
  onMemberships,
  onTournaments,
  onTournamentEntries,
  onVisitors,
  isClub,
  isPlayer,
  isOrganizer = false,
}: {
  onSettings(): void;
  onDiscover(): void;
  onConnections(): void;
  onTeamRequests(): void;
  onMyTeamApplications(): void;
  onBuyTeamRights(): void;
  onNews(): void;
  onGifts(): void;
  onSquad(): void;
  onClubListings(): void;
  onListings(): void;
  onMemberships(): void;
  onTournaments(): void;
  onTournamentEntries(): void;
  onVisitors(): void;
  isClub: boolean;
  isPlayer: boolean;
  // Organizers only see tournaments, news and account; the other entries
  // open player or club features the server rejects for them.
  isOrganizer?: boolean;
}) {
  const text = copy.more;
  const entry = (
    title: string,
    hint: string,
    icon: LucideIcon,
    onPress: () => void,
  ): Entry => ({ title, hint, icon, onPress });
  const tournaments = entry(
    text.tournaments,
    text.tournamentsHint,
    Medal,
    onTournaments,
  );
  const news = entry(text.news, text.newsHint, Newspaper, onNews);
  const settings = entry(
    text.settings,
    text.settingsHint,
    Settings,
    onSettings,
  );
  const network: Section = {
    title: text.sections.network,
    entries: [
      entry(text.discover, text.discoverHint, Compass, onDiscover),
      entry(
        text.connections,
        text.connectionsHint,
        MessagesSquare,
        onConnections,
      ),
      entry(text.visitors, text.visitorsHint, Eye, onVisitors),
    ],
  };
  const explore: Section = { title: text.sections.explore, entries: [news] };
  const account: Section = {
    title: text.sections.account,
    entries: [settings],
  };
  // Grouped by what the account does most, then network, rewards and account.
  const sections: Section[] = isOrganizer
    ? [
        { title: text.sections.tournaments, entries: [tournaments] },
        explore,
        account,
      ]
    : isClub
    ? [
        {
          title: text.sections.club,
          entries: [
            entry(
              text.teamRequests,
              text.teamRequestsHint,
              ClipboardList,
              onTeamRequests,
            ),
            entry(text.squad, text.squadHint, Users, onSquad),
            entry(
              text.clubListings,
              text.clubListingsHint,
              Megaphone,
              onClubListings,
            ),
          ],
        },
        {
          title: text.sections.tournaments,
          entries: [
            tournaments,
            entry(
              text.tournamentEntries,
              text.tournamentEntriesHint,
              ClipboardList,
              onTournamentEntries,
            ),
          ],
        },
        network,
        {
          title: text.sections.rewards,
          entries: [entry(text.gifts, text.giftsHint, Gift, onGifts)],
        },
        explore,
        account,
      ]
    : [
        {
          title: text.sections.career,
          entries: [
            entry(text.listings, text.listingsHint, Megaphone, onListings),
            ...(isPlayer
              ? [
                  entry(
                    text.myTeamApplications,
                    text.myTeamApplicationsHint,
                    ClipboardList,
                    onMyTeamApplications,
                  ),
                  entry(
                    text.memberships,
                    text.membershipsHint,
                    Shield,
                    onMemberships,
                  ),
                ]
              : []),
            tournaments,
          ],
        },
        network,
        {
          title: text.sections.rewards,
          entries: [
            ...(isPlayer
              ? [
                  entry(
                    text.buyTeamRights,
                    text.buyTeamRightsHint,
                    ShoppingBag,
                    onBuyTeamRights,
                  ),
                ]
              : []),
            entry(text.gifts, text.giftsHint, Gift, onGifts),
          ],
        },
        explore,
        account,
      ];
  return (
    <Screen>
      <Brand mark={false} />
      {sections.map(section => (
        <View key={section.title} style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {section.title}
          </Text>
          <View style={styles.group}>
            {section.entries.map(({ title, hint, icon: Icon, onPress }, i) => (
              <Pressable
                key={title}
                accessibilityRole="button"
                accessibilityLabel={title}
                accessibilityHint={hint}
                onPress={onPress}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && styles.divider,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.icon}>
                  <Icon size={20} color={colors.brand} strokeWidth={2} />
                </View>
                <View style={styles.text}>
                  <Text numberOfLines={1} style={styles.title}>
                    {title}
                  </Text>
                  <Text numberOfLines={1} style={styles.hint}>
                    {hint}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: space.xs,
  },
  group: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.hairline },
  pressed: { backgroundColor: colors.raised },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandWash,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 16 },
});
