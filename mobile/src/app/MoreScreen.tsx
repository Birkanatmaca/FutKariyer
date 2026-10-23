import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ArrowLeftRight,
  ChevronRight,
  ClipboardList,
  FileText,
  LifeBuoy,
  Scale,
  ShieldCheck,
  Trophy,
  ShoppingBag,
  Settings,
  Newspaper,
  Gift,
  Medal,
  Megaphone,
  Shield,
  Undo2,
  UserRoundPlus,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react-native';
import { Screen } from '../shared/ui/Screen';
import { Brand } from '../shared/ui/Brand';
import { Avatar } from '../shared/ui/Avatar';
import { copy } from '../shared/lib/copy';
import { openLegal, openSupport, supportAvailable } from '../shared/lib/legal';
import { colors, radius, space } from '../styles/tokens';

type Entry = {
  title: string;
  hint: string;
  icon: LucideIcon;
  onPress(): void;
};
type Section = { title: string; entries: Entry[] };
// The signed-in account shown at the top of Diğer; it opens the Profil stack.
export type MoreProfile = {
  name: string;
  role: string;
  avatarUri?: string;
  square: boolean;
};

export function MoreScreen({
  profile,
  onProfile,
  onSettings,
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
  onSquadInvites,
  onMyTournaments,
  squadInviteCount,
  isClub,
  isPlayer,
  isOrganizer = false,
  onStaff,
  onCoachClubs,
  delegate,
}: {
  // Organizers have no profile, so they get no card.
  profile?: MoreProfile | null;
  onProfile(): void;
  onSettings(): void;
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
  // Player: Kulüp davetleri with the number of open invitations when known.
  onSquadInvites?(): void;
  // Players: tournaments their team plays in (23 Oct 2026).
  onMyTournaments?(): void;
  squadInviteCount?: number | null;
  isClub: boolean;
  isPlayer: boolean;
  // Organizers only see tournaments, news and account; the other entries
  // open player or club features the server rejects for them.
  isOrganizer?: boolean;
  // Club owner: Teknik ekip. Coach: Kulüplerim.
  onStaff?(): void;
  onCoachClubs?(): void;
  // A coach running a club account sees only the sections the club opened,
  // and a way back instead of the account settings.
  delegate?: {
    coachName: string;
    permissions: string[];
    onBack(): void;
  } | null;
}) {
  const allowed = (permission: string) =>
    !delegate || delegate.permissions.includes(permission);
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
  const explore: Section = { title: text.sections.explore, entries: [news] };
  const account: Section = {
    title: text.sections.account,
    entries: delegate
      ? [
          entry(
            copy.coaches.backTo(delegate.coachName),
            copy.coaches.backHint,
            Undo2,
            delegate.onBack,
          ),
        ]
      : [settings],
  };
  // Grouped by what the account does most, then rewards and account. Discovery,
  // requests and visitors moved to the Social header (19 Oct 2026).
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
            ...(allowed('applications')
              ? [
                  entry(
                    text.teamRequests,
                    text.teamRequestsHint,
                    ClipboardList,
                    onTeamRequests,
                  ),
                ]
              : []),
            ...(allowed('squad')
              ? [entry(text.squad, text.squadHint, Users, onSquad)]
              : []),
            ...(allowed('listings')
              ? [
                  entry(
                    text.clubListings,
                    text.clubListingsHint,
                    Megaphone,
                    onClubListings,
                  ),
                ]
              : []),
            ...(onStaff && !delegate
              ? [
                  entry(
                    copy.coaches.staff,
                    copy.coaches.staffHint,
                    UsersRound,
                    onStaff,
                  ),
                ]
              : []),
          ],
        },
        {
          title: text.sections.tournaments,
          entries: [
            tournaments,
            ...(allowed('tournaments')
              ? [
                  entry(
                    text.tournamentEntries,
                    text.tournamentEntriesHint,
                    ClipboardList,
                    onTournamentEntries,
                  ),
                ]
              : []),
          ],
        },
        ...(delegate
          ? []
          : [
              {
                title: text.sections.rewards,
                entries: [entry(text.gifts, text.giftsHint, Gift, onGifts)],
              },
            ]),
        explore,
        account,
      ]
    : [
        {
          title: text.sections.career,
          entries: [
            ...(onCoachClubs
              ? [
                  entry(
                    copy.coaches.myClubs,
                    copy.coaches.myClubsHint,
                    ArrowLeftRight,
                    onCoachClubs,
                  ),
                ]
              : []),
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
                  ...(onSquadInvites
                    ? [
                        entry(
                          text.squadInvites,
                          squadInviteCount
                            ? text.squadInvitesPending(squadInviteCount)
                            : text.squadInvitesHint,
                          UserRoundPlus,
                          onSquadInvites,
                        ),
                      ]
                    : []),
                  ...(onMyTournaments
                    ? [
                        entry(
                          copy.tournaments.playerTitle,
                          copy.tournaments.playerHint,
                          Trophy,
                          onMyTournaments,
                        ),
                      ]
                    : []),
                ]
              : []),
            tournaments,
          ],
        },
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
  // Every account reaches the legal pages and support (23 Oct 2026).
  sections.push({
    title: copy.legal.section,
    entries: [
      ...(supportAvailable()
        ? [
            entry(copy.legal.support, copy.legal.supportHint, LifeBuoy, () =>
              openSupport().catch(() => undefined),
            ),
          ]
        : []),
      entry(copy.legal.terms, copy.legal.termsHint, FileText, () =>
        openLegal('terms').catch(() => undefined),
      ),
      entry(copy.legal.privacy, copy.legal.privacyHint, ShieldCheck, () =>
        openLegal('privacy').catch(() => undefined),
      ),
      entry(copy.legal.kvkk, copy.legal.kvkkHint, Scale, () =>
        openLegal('kvkk').catch(() => undefined),
      ),
    ],
  });
  const shown = sections.filter(section => section.entries.length > 0);
  return (
    <Screen>
      <Brand mark={false} />
      {profile ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={profile.name + ', ' + text.profileOpen}
          onPress={onProfile}
          style={({ pressed }) => [styles.profile, pressed && styles.pressed]}
        >
          <Avatar
            name={profile.name}
            uri={profile.avatarUri}
            size={56}
            square={profile.square}
            style={styles.avatar}
          />
          <View style={styles.text}>
            <Text numberOfLines={1} style={styles.profileName}>
              {profile.name}
            </Text>
            <Text numberOfLines={1} style={styles.hint}>
              {profile.role}
            </Text>
            <Text numberOfLines={1} style={styles.profileLink}>
              {text.profileOpen}
            </Text>
          </View>
          <ChevronRight size={20} color={colors.muted} />
        </Pressable>
      ) : null}
      {shown.map(section => (
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
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  avatar: { borderWidth: 2, borderColor: colors.brand },
  profileName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  profileLink: { color: colors.brand, fontSize: 12, fontWeight: '700' },
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
