import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  DarkTheme,
  NavigationContainer,
  createNavigationContainerRef,
  useFocusEffect,
  getFocusedRouteNameFromRoute,
} from '@react-navigation/native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type {
  BottomTabBarProps,
  BottomTabNavigationProp,
} from '@react-navigation/bottom-tabs';
import { AccountScreen, useAuth } from '../features/auth';
import {
  CoachClubsScreen,
  CoachOverviewScreen,
  CoachProfileEditScreen,
  CoachPublicCard,
  DelegateBanner,
  StaffScreen,
  SwitchClubButton,
  coachRepository,
} from '../features/coaches';
import { BlockedUsersScreen, moderationService } from '../features/moderation';
import {
  DiscoverScreen,
  DiscoveryProfileScreen,
  ScoutScreen,
  WatchButton,
  createDiscoveryService,
  discoveryRepository,
  type DiscoveryKind,
} from '../features/discovery';
import { CoachTeamTab } from './CoachTeamTab';
import {
  createContentService,
  contentRepository,
  LaunchPopup,
  NewsScreen,
  NewsDetailScreen,
} from '../features/content';
import {
  ConnectionPanel,
  ConnectionsScreen,
  connectionsRepository,
  createConnectionsService,
  useIncomingCount,
} from '../features/connections';
import {
  GiftsScreen,
  createGiftsService,
  giftsRepository,
} from '../features/gifts';
import { LeagueDetailScreen } from '../features/leagues';
import {
  AnkaraScreen,
  CompetitionScreen,
  createFootballService,
  footballRepository,
  type Competition,
} from '../features/football';
import {
  ClubHomeScreen,
  ClubNewsComposeScreen,
  ClubNewsMineScreen,
  ClubMatchesView,
  ClubProfileEditScreen,
  ClubTffLinkScreen,
  clubRepository,
  createClubService,
} from '../features/clubs';
import {
  TeamRightsScreen,
  storeCheckout,
  useStoreRecovery,
} from '../features/payments';
import {
  PrivateBrowsingSetting,
  ProScreen,
  VisitorsScreen,
  createProService,
  proRepository,
  useProStatus,
} from '../features/pro';
import {
  ClubListingsScreen,
  ListingDetailScreen,
  ListingsScreen,
  createListingsService,
  listingsRepository,
} from '../features/listings';
import {
  MembershipsScreen,
  SquadScreen,
  createSquadService,
  squadRepository,
} from '../features/squad';
import {
  SocialFeedScreen,
  SocialThreadScreen,
  SocialPublishScreen,
  createSocialService,
  socialRepository,
} from '../features/social';
import {
  createNotificationsService,
  notificationsRepository,
  NotificationsScreen,
  pushMessaging,
  pushRepository,
  usePushRegistration,
} from '../features/notifications';
import {
  TeamApplicationsScreen,
  TeamJoinRequestsScreen,
  TeamsScreen,
} from '../features/teams';
import {
  OrganizerHomeScreen,
  OrganizerTournamentScreen,
  TournamentDetailScreen,
  TournamentEntriesScreen,
  TournamentsScreen,
  createTournamentsService,
  tournamentsRepository,
  type ClubEntrySource,
} from '../features/tournaments';
import {
  PlayerProfileScreen,
  PlayerOverviewScreen,
  createPlayerProfileService,
  playerProfileRepository,
  playerMediaService,
  profileSharer,
  type ProfileCounts,
} from '../features/players';
import { Wordmark } from '../shared/ui/Wordmark';
import { wordmarkSize } from '../shared/ui/brand-paths';
import { Button } from '../shared/ui/Button';
import { ErrorBanner } from '../shared/ui/ErrorBanner';
import { copy } from '../shared/lib/copy';
import { colors, space } from '../styles/tokens';
import { HomeScreen } from './HomeScreen';
import { LeaguesHomeScreen } from './LeaguesHomeScreen';
import { LeaguesSearchScreen } from './LeaguesSearchScreen';
import {
  AccountProfileScreen,
  accountRepository,
  avatarUrl,
  useAccountProfile,
} from '../features/account';
import { SocialSidebar } from './SocialSidebar';
import { FutTabBar } from './FutTabBar';
import { MoreScreen } from './MoreScreen';
import { GamesTab } from './GamesTab';
import { AdminNavigator } from './AdminNavigator';
import { AuthNavigator } from './AuthNavigator';
import { useProfilePostsSlot } from './useProfilePostsSlot';

// Bar (19 Oct 2026): Ana Sayfa, Ligler | centre hub | Bildirimler, Diğer.
// Sosyal, Profil, Takımlar and Oyunlar are the hub's pages (see HubArt).
type MainRoutes = {
  Home: undefined;
  Leagues: NavigatorScreenParams<LeaguesRoutes> | undefined;
  Social: NavigatorScreenParams<SocialRoutes> | undefined;
  Profile: NavigatorScreenParams<ProfileRoutes> | undefined;
  Teams: { open?: { id: string; at: number } } | undefined;
  Scout: NavigatorScreenParams<ScoutRoutes> | undefined;
  Games: undefined;
  Notifications: undefined;
  More: NavigatorScreenParams<MoreRoutes> | undefined;
};
type ProfileRoutes = {
  ProfileHome: undefined;
  AccountProfile: undefined;
  PlayerProfile: undefined;
  CoachProfile: undefined;
  PostThread: { id: string };
  PostPublish: undefined;
};
// Keşif (20 Oct 2026): a coach's scouting page and the players it opens.
type ScoutRoutes = {
  ScoutHome: undefined;
  ScoutProfile: { id: string };
};
type DiscoveryRoutes = {
  DiscoveryList: undefined;
  DiscoveryProfile: { kind: DiscoveryKind; id: string };
};
type MoreRoutes = {
  MoreHome: undefined;
  Account: undefined;
  BlockedUsers: undefined;
  Discover: NavigatorScreenParams<DiscoveryRoutes> | undefined;
  Connections: undefined;
  TeamJoinRequests: undefined;
  TeamApplications: undefined;
  TeamRights: undefined;
  News: NavigatorScreenParams<NewsRoutes> | undefined;
  Gifts: undefined;
  ClubProfileEdit: undefined;
  ClubTffLink: undefined;
  ClubNewsCompose: undefined;
  ClubNewsMine: undefined;
  Squad: undefined;
  Memberships: undefined;
  ClubListings: undefined;
  Listings: undefined;
  ListingDetail: { id: string };
  Tournaments: undefined;
  TournamentDetail: { id: string };
  TournamentEntries: undefined;
  OrganizerTournament: { id: string };
  Visitors: undefined;
  Pro: undefined;
  // Coach: club invitations and switching; club owner: technical staff.
  CoachClubs: undefined;
  Staff: undefined;
};
type LeaguesRoutes = {
  LeaguesHome: undefined;
  Competition: { competition: Competition };
  Ankara: undefined;
  LeagueDetail: { id: string };
  Search: undefined;
};
type NewsRoutes = { NewsList: undefined; NewsDetail: { id: string } };
type SocialRoutes = {
  SocialFeed: { publishedAt?: number } | undefined;
  SocialThread: { id: string };
  SocialPublish: undefined;
  // Header shortcuts (19 Oct 2026): open inside the Social stack so back
  // returns to the feed and the Social tab stays selected.
  SocialConnections: undefined;
  SocialDiscover: NavigatorScreenParams<DiscoveryRoutes> | undefined;
  SocialVisitors: undefined;
};
const SocialStack = createNativeStackNavigator<SocialRoutes>();
const NewsStack = createNativeStackNavigator<NewsRoutes>();
const LeaguesStack = createNativeStackNavigator<LeaguesRoutes>();
const footballService = createFootballService(footballRepository);
const contentService = createContentService(contentRepository);
const Tabs = createBottomTabNavigator<MainRoutes>();
const ProfileStack = createNativeStackNavigator<ProfileRoutes>();
const DiscoveryStack = createNativeStackNavigator<DiscoveryRoutes>();
const ScoutStack = createNativeStackNavigator<ScoutRoutes>();
const MoreStack = createNativeStackNavigator<MoreRoutes>();
const discoveryService = createDiscoveryService(discoveryRepository);
const playerProfileService = createPlayerProfileService(
  playerProfileRepository,
);
// The native launch screens show the FUTCAREER wordmark alone at this width
// (mobile/scripts/app-icon.sh); the startup screen repeats it in place.
const launchWordmarkWidth = 216;
const navigationRef = createNavigationContainerRef<MainRoutes>();
const openNotifications = () => {
  if (navigationRef.isReady()) navigationRef.navigate('Notifications');
};
const notificationsService = createNotificationsService(
  notificationsRepository,
);
const socialService = createSocialService(socialRepository);
const giftsService = createGiftsService(giftsRepository);
const connectionsService = createConnectionsService(connectionsRepository);
const clubService = createClubService(clubRepository);
const squadService = createSquadService(squadRepository);
const listingsService = createListingsService(listingsRepository);
const tournamentsService = createTournamentsService(tournamentsRepository);
const proService = createProService(proRepository);
// A club enters tournaments with its own team type and squad players.
const clubEntrySource: ClubEntrySource = {
  footballType: token =>
    clubService.profile(token).then(profile => profile.footballType),
  squad: token =>
    squadService.squad(token).then(members =>
      members.map(member => ({
        id: member.playerId,
        name: member.name,
        position: member.position,
      })),
    ),
};
const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.brand,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.brand,
  },
};
function MainTabs() {
  const { user, token, delegate, switchToClub, switchBack } = useAuth();
  // A coach running a club account buys nothing and registers no device for
  // the club's pushes.
  useStoreRecovery(storeCheckout, delegate ? null : token);
  usePushRegistration(
    pushMessaging,
    pushRepository,
    delegate ? null : token,
    openNotifications,
  );
  // Organizers have no profile and the social and games APIs reject them, so
  // their hub only holds Takımlar.
  const member = user?.role !== 'organizer';
  // The Bildirimler tab badge is refreshed whenever any tab gains focus.
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const refreshUnread = useCallback(() => {
    if (!token) {
      setUnreadCount(null);
      return;
    }
    notificationsService
      .unreadCount(token)
      .then(setUnreadCount)
      .catch(() => setUnreadCount(null));
  }, [token]);
  useEffect(refreshUnread, [refreshUnread]);
  // A coach on a club's staff gets Takımım in place of Takımlar, and Keşif.
  const coach = user?.role === 'coach' && !delegate;
  const [hasTeam, setHasTeam] = useState(false);
  const refreshTeam = useCallback(() => {
    if (!token || !coach) {
      setHasTeam(false);
      return;
    }
    coachRepository
      .memberships(token)
      .then(items => setHasTeam(items.some(item => item.status === 'active')))
      .catch(() => undefined);
  }, [token, coach]);
  useEffect(refreshTeam, [refreshTeam]);
  const refreshTabs = useCallback(() => {
    refreshUnread();
    refreshTeam();
  }, [refreshUnread, refreshTeam]);
  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => {
      const route = props.state.routes[props.state.index];
      if (
        route.name === 'Social' &&
        getFocusedRouteNameFromRoute(route) === 'SocialPublish'
      )
        return null;
      return (
        <FutTabBar
          {...props}
          badges={{ Notifications: unreadCount }}
          labels={{
            ...copy.tabs,
            Teams: hasTeam ? copy.tabs.MyTeam : copy.tabs.Teams,
          }}
        />
      );
    },
    [unreadCount, hasTeam],
  );
  return (
    <View style={styles.main}>
      {/* A popup ad, when one is due, opens once as the signed-in app starts. */}
      <LaunchPopup token={token} service={contentService} enabled={!delegate} />
      {delegate && user ? (
        <DelegateBanner
          clubName={user.fullName}
          coachName={delegate.coachName}
          onBack={switchBack}
        />
      ) : null}
      <Tabs.Navigator
        tabBar={renderTabBar}
        screenListeners={{ focus: refreshTabs }}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen name="Home">
          {({ navigation }) =>
            user?.role === 'organizer' ? (
              <OrganizerHomeScreen
                service={tournamentsService}
                onOpen={id =>
                  navigation.navigate('More', {
                    screen: 'OrganizerTournament',
                    params: { id },
                    initial: false,
                  })
                }
              />
            ) : user?.role === 'club' ? (
              <ClubHomeScreen
                clubService={clubService}
                contentService={contentService}
                onProfile={() =>
                  navigation.navigate('More', {
                    screen: 'ClubProfileEdit',
                    initial: false,
                  })
                }
                onLinkTff={() =>
                  navigation.navigate('More', {
                    screen: 'ClubTffLink',
                    initial: false,
                  })
                }
                onLeagues={() => navigation.navigate('Leagues')}
                onTeamRequests={() =>
                  navigation.navigate('More', {
                    screen: 'TeamJoinRequests',
                    initial: false,
                  })
                }
                onNews={() =>
                  navigation.navigate('More', {
                    screen: 'News',
                    params: { screen: 'NewsList' },
                    initial: false,
                  })
                }
                onComposeNews={() =>
                  navigation.navigate('More', {
                    screen: 'ClubNewsCompose',
                    initial: false,
                  })
                }
                onMyNews={() =>
                  navigation.navigate('More', {
                    screen: 'ClubNewsMine',
                    initial: false,
                  })
                }
                onDiscover={() =>
                  navigation.navigate('More', {
                    screen: 'Discover',
                    initial: false,
                  })
                }
                onSquad={() =>
                  navigation.navigate('More', {
                    screen: 'Squad',
                    initial: false,
                  })
                }
                onListings={() =>
                  navigation.navigate('More', {
                    screen: 'ClubListings',
                    initial: false,
                  })
                }
                onTournaments={() =>
                  navigation.navigate('More', {
                    screen: 'Tournaments',
                    initial: false,
                  })
                }
                onTournamentEntries={() =>
                  navigation.navigate('More', {
                    screen: 'TournamentEntries',
                    initial: false,
                  })
                }
              />
            ) : (
              <HomeScreen
                headerAction={
                  user?.role === 'coach' && token ? (
                    <SwitchClubButton
                      token={token}
                      service={coachRepository}
                      onSwitch={switchToClub}
                    />
                  ) : undefined
                }
                contentService={contentService}
                discoveryService={discoveryService}
                giftsService={giftsService}
                notificationsService={notificationsService}
                onTeams={() => navigation.navigate('Teams')}
                onLeagues={() => navigation.navigate('Leagues')}
                onDiscover={() =>
                  navigation.navigate('More', {
                    screen: 'Discover',
                    initial: false,
                  })
                }
                onRights={() =>
                  navigation.navigate('More', {
                    screen: 'TeamRights',
                    initial: false,
                  })
                }
                onNotifications={() => navigation.navigate('Notifications')}
                onProfile={() => navigation.navigate('Profile')}
                onNews={() =>
                  navigation.navigate('More', {
                    screen: 'News',
                    params: { screen: 'NewsList' },
                    initial: false,
                  })
                }
                onVisitors={() =>
                  navigation.navigate('More', {
                    screen: 'Visitors',
                    initial: false,
                  })
                }
              />
            )
          }
        </Tabs.Screen>
        <Tabs.Screen
          name="Leagues"
          component={LeaguesNavigator}
          options={{ popToTopOnBlur: true }}
        />
        {member ? (
          <Tabs.Screen
            name="Social"
            component={SocialNavigator}
            options={{ popToTopOnBlur: true }}
          />
        ) : null}
        {member && !delegate ? (
          <Tabs.Screen name="Profile" options={{ popToTopOnBlur: true }}>
            {() => <ProfileNavigator />}
          </Tabs.Screen>
        ) : null}
        <Tabs.Screen name="Teams">
          {({ navigation, route }) =>
            coach && hasTeam && token ? (
              <CoachTeamTab
                token={token}
                clubService={clubService}
                onSwitch={switchToClub}
                onInvitations={() =>
                  navigation.navigate('More', {
                    screen: 'CoachClubs',
                    initial: false,
                  })
                }
                onLeagues={() => navigation.navigate('Leagues')}
              />
            ) : (
              <TeamsScreen
                open={route.params?.open}
                onOpenRights={() =>
                  navigation.navigate('More', {
                    screen: 'TeamRights',
                    initial: false,
                  })
                }
              />
            )
          }
        </Tabs.Screen>
        {coach ? (
          <Tabs.Screen
            name="Scout"
            component={ScoutNavigator}
            options={{ popToTopOnBlur: true }}
          />
        ) : null}
        {member && !delegate ? (
          <Tabs.Screen name="Games">
            {() => (token ? <GamesTab token={token} /> : null)}
          </Tabs.Screen>
        ) : null}
        <Tabs.Screen name="Notifications" component={NotificationsTab} />
        <Tabs.Screen
          name="More"
          component={MoreNavigator}
          options={{ popToTopOnBlur: true }}
        />
      </Tabs.Navigator>
    </View>
  );
}

function MoreNavigator() {
  const { token, user, delegate, switchToClub } = useAuth();
  // Organizers are rejected by the social, discovery, connection and gift
  // endpoints; their routes render nothing even if reached directly.
  const member = user?.role !== 'organizer';
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <MoreStack.Screen name="MoreHome">
        {({ navigation }) => (
          <MoreHomeRoute
            navigation={navigation}
            isClub={user?.role === 'club'}
            isPlayer={user?.role === 'player'}
            isOrganizer={!member}
          />
        )}
      </MoreStack.Screen>
      <MoreStack.Screen name="CoachClubs">
        {({ navigation }) =>
          token && user?.role === 'coach' ? (
            <CoachClubsScreen
              token={token}
              service={coachRepository}
              onBack={() => navigation.goBack()}
              onSwitch={switchToClub}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="Staff">
        {({ navigation }) =>
          token && user?.role === 'club' && !delegate ? (
            <StaffScreen
              token={token}
              service={coachRepository}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="News">
        {({ navigation }) => (
          <NewsNavigator onBack={() => navigation.goBack()} />
        )}
      </MoreStack.Screen>
      <MoreStack.Screen name="Account">
        {({ navigation }) => (
          <AccountScreen
            onBack={() => navigation.goBack()}
            onBlockedUsers={() => navigation.navigate('BlockedUsers')}
            extra={
              token && member ? (
                <PrivateBrowsingSetting
                  token={token}
                  service={proService}
                  onUpgrade={() => navigation.navigate('Pro')}
                />
              ) : null
            }
          />
        )}
      </MoreStack.Screen>
      <MoreStack.Screen name="BlockedUsers">
        {({ navigation }) =>
          token ? (
            <BlockedUsersScreen
              token={token}
              service={moderationService}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="Visitors">
        {({ navigation }) =>
          token && member ? (
            <VisitorsScreen
              token={token}
              service={proService}
              onBack={() => navigation.goBack()}
              onUpgrade={() => navigation.navigate('Pro')}
              onOpenProfile={(kind, id) =>
                navigation.navigate('Discover', {
                  screen: 'DiscoveryProfile',
                  params: { kind, id },
                  initial: false,
                })
              }
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="Pro">
        {({ navigation }) =>
          token && member ? (
            <ProScreen
              token={token}
              service={proService}
              checkout={storeCheckout}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="Discover">
        {({ navigation }) =>
          member ? (
            <DiscoveryNavigator onBack={() => navigation.goBack()} />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="Gifts">
        {({ navigation }) =>
          token && member ? (
            <GiftsScreen
              token={token}
              service={giftsService}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="Connections">
        {({ navigation }) =>
          token && member ? (
            <ConnectionsScreen
              token={token}
              service={connectionsService}
              onBack={() => navigation.goBack()}
              onDiscover={() => navigation.navigate('Discover')}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="TeamJoinRequests">
        {({ navigation }) =>
          token ? (
            <TeamJoinRequestsScreen
              token={token}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="TeamApplications">
        {({ navigation }) =>
          token && user?.role === 'player' ? (
            <TeamApplicationsScreen
              token={token}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="TeamRights">
        {({ navigation }) =>
          token && user?.role === 'player' ? (
            <TeamRightsScreen
              token={token}
              checkout={storeCheckout}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="ClubProfileEdit">
        {({ navigation }) =>
          token && user?.role === 'club' ? (
            <ClubProfileEditScreen
              token={token}
              service={clubService}
              onBack={() => navigation.goBack()}
              onTff={() => navigation.navigate('ClubTffLink')}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="ClubTffLink">
        {({ navigation }) =>
          token && user?.role === 'club' ? (
            <ClubTffLinkScreen
              token={token}
              service={clubService}
              footballService={footballService}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="ClubNewsCompose">
        {({ navigation }) =>
          token && user?.role === 'club' ? (
            <ClubNewsComposeScreen
              token={token}
              service={clubService}
              onBack={() => navigation.goBack()}
              onMine={() => navigation.navigate('ClubNewsMine')}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="ClubNewsMine">
        {({ navigation }) =>
          token && user?.role === 'club' ? (
            <ClubNewsMineScreen
              token={token}
              service={clubService}
              onBack={() => navigation.goBack()}
              onCompose={() => navigation.navigate('ClubNewsCompose')}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="Squad">
        {({ navigation }) =>
          token && user?.role === 'club' ? (
            <SquadScreen
              token={token}
              service={squadService}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="ClubListings">
        {({ navigation }) =>
          token && user?.role === 'club' ? (
            <ClubListingsScreen
              token={token}
              service={listingsService}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="Memberships">
        {({ navigation }) =>
          token && user?.role === 'player' ? (
            <MembershipsScreen
              token={token}
              service={squadService}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="Listings">
        {({ navigation }) =>
          token && member ? (
            <ListingsScreen
              token={token}
              service={listingsService}
              onBack={() => navigation.goBack()}
              onOpen={id => navigation.navigate('ListingDetail', { id })}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="ListingDetail">
        {({ navigation, route }) =>
          token && member ? (
            <ListingDetailScreen
              token={token}
              id={route.params.id}
              service={listingsService}
              canApply={user?.role === 'player'}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="Tournaments">
        {({ navigation }) =>
          token ? (
            <TournamentsScreen
              token={token}
              service={tournamentsService}
              onBack={() => navigation.goBack()}
              onOpen={id => navigation.navigate('TournamentDetail', { id })}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="TournamentDetail">
        {({ navigation, route }) =>
          token ? (
            <TournamentDetailScreen
              token={token}
              id={route.params.id}
              service={tournamentsService}
              club={user?.role === 'club' ? clubEntrySource : undefined}
              onBack={() => navigation.goBack()}
              onEntries={() => navigation.navigate('TournamentEntries')}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="TournamentEntries">
        {({ navigation }) =>
          token && user?.role === 'club' ? (
            <TournamentEntriesScreen
              token={token}
              service={tournamentsService}
              onBack={() => navigation.goBack()}
              onOpen={id => navigation.navigate('TournamentDetail', { id })}
            />
          ) : null
        }
      </MoreStack.Screen>
      <MoreStack.Screen name="OrganizerTournament">
        {({ navigation, route }) =>
          token && user?.role === 'organizer' ? (
            <OrganizerTournamentScreen
              token={token}
              id={route.params.id}
              service={tournamentsService}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
      </MoreStack.Screen>
    </MoreStack.Navigator>
  );
}

// Notification cards open screens that live in the Diğer stack.
function NotificationsTab({
  navigation,
}: {
  navigation: BottomTabNavigationProp<MainRoutes, 'Notifications'>;
}) {
  const { token, user } = useAuth();
  if (!token) return null;
  const openMore = (route: MoreRoute) =>
    navigation.navigate('More', { ...route, initial: false });
  return (
    <NotificationsScreen
      token={token}
      service={notificationsService}
      onOpenGifts={() => openMore({ screen: 'Gifts' })}
      onOpenConnections={() => openMore({ screen: 'Connections' })}
      onOpenStaff={() =>
        user?.role === 'coach'
          ? openMore({ screen: 'CoachClubs' })
          : user?.role === 'club' && !user.delegate
          ? openMore({ screen: 'Staff' })
          : undefined
      }
      onOpenProfile={(id, role) =>
        openMore({
          screen: 'Discover',
          params: {
            screen: 'DiscoveryProfile',
            params: {
              id,
              kind:
                role === 'club'
                  ? 'clubs'
                  : role === 'coach'
                  ? 'coaches'
                  : 'players',
            },
          },
        })
      }
      onFollowBack={id =>
        socialService.follow(token, id, true).then(() => undefined)
      }
      onOpenListing={id =>
        // Opportunity notifications also come from admin announcements;
        // only an open listing is opened, otherwise the card just marks read.
        listingsService
          .findOpen(token, id)
          .then(listing => {
            if (listing) openMore({ screen: 'ListingDetail', params: { id } });
          })
          .catch(() => undefined)
      }
      onOpenTournament={resourceId =>
        // New tournament notifications carry the tournament id; entry,
        // decision and cancellation notifications carry an entry id.
        tournamentsService
          .find(token, resourceId)
          .then(tournament => {
            if (user?.role === 'organizer') {
              if (tournament && tournament.organizerId === user.id) {
                openMore({
                  screen: 'OrganizerTournament',
                  params: { id: tournament.id },
                });
              } else {
                navigation.navigate('Home');
              }
            } else if (tournament) {
              openMore({
                screen: 'TournamentDetail',
                params: { id: tournament.id },
              });
            } else if (user?.role === 'club') {
              openMore({ screen: 'TournamentEntries' });
            }
          })
          .catch(() => undefined)
      }
    />
  );
}
type MoreRoute = {
  [K in keyof MoreRoutes]: undefined extends MoreRoutes[K]
    ? { screen: K; params?: MoreRoutes[K] }
    : { screen: K; params: MoreRoutes[K] };
}[keyof MoreRoutes];

function MoreHomeRoute({
  navigation,
  isClub,
  isPlayer,
  isOrganizer,
}: {
  navigation: NativeStackNavigationProp<MoreRoutes, 'MoreHome'>;
  isClub: boolean;
  isPlayer: boolean;
  isOrganizer: boolean;
}) {
  const { token, user, delegate, switchBack } = useAuth();
  const account = useAccountProfile(accountRepository, token);
  // A switched coach sees no club profile card: the club's account is the
  // owner's to edit.
  const profile =
    user && !isOrganizer && !delegate
      ? {
          name: account.profile?.fullName ?? user.fullName,
          role: copy.roles[user.role],
          avatarUri: account.profile
            ? avatarUrl(account.profile.id, account.profile.avatarVersion)
            : undefined,
          square: isClub,
        }
      : null;
  return (
    <MoreScreen
      profile={profile}
      onProfile={() =>
        (
          navigation.getParent() as
            | BottomTabNavigationProp<MainRoutes>
            | undefined
        )?.navigate('Profile')
      }
      onSettings={() => navigation.navigate('Account')}
      onTeamRequests={() => navigation.navigate('TeamJoinRequests')}
      onMyTeamApplications={() => navigation.navigate('TeamApplications')}
      onBuyTeamRights={() => navigation.navigate('TeamRights')}
      onNews={() => navigation.navigate('News')}
      onGifts={() => navigation.navigate('Gifts')}
      onSquad={() => navigation.navigate('Squad')}
      onClubListings={() => navigation.navigate('ClubListings')}
      onListings={() => navigation.navigate('Listings')}
      onMemberships={() => navigation.navigate('Memberships')}
      onTournaments={() => navigation.navigate('Tournaments')}
      onTournamentEntries={() => navigation.navigate('TournamentEntries')}
      isClub={isClub}
      isPlayer={isPlayer}
      isOrganizer={isOrganizer}
      onStaff={
        isClub && !delegate ? () => navigation.navigate('Staff') : undefined
      }
      onCoachClubs={
        user?.role === 'coach'
          ? () => navigation.navigate('CoachClubs')
          : undefined
      }
      delegate={
        delegate
          ? {
              coachName: delegate.coachName,
              permissions: delegate.permissions,
              onBack: switchBack,
            }
          : null
      }
    />
  );
}

function DiscoveryNavigator({ onBack }: { onBack(): void }) {
  const { token, user } = useAuth();
  if (!user || user.role === 'organizer') {
    return null;
  }
  const viewer = { role: user.role, verified: user.verified };
  return (
    <DiscoveryStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <DiscoveryStack.Screen name="DiscoveryList">
        {({ navigation }) => (
          <DiscoverScreen
            service={discoveryService}
            token={token}
            role={user.role}
            onBack={onBack}
            onOpen={(kind, id) =>
              navigation.navigate('DiscoveryProfile', { kind, id })
            }
          />
        )}
      </DiscoveryStack.Screen>
      <DiscoveryStack.Screen name="DiscoveryProfile">
        {({ navigation, route }) => (
          <DiscoveryProfileScreen
            usePostsSlot={useDiscoveryPostsSlot}
            service={discoveryService}
            token={token}
            kind={route.params.kind}
            id={route.params.id}
            onBack={() => navigation.goBack()}
            renderConnection={profile =>
              token ? (
                <>
                  {user.role === 'coach' && profile.role === 'player' ? (
                    <WatchButton
                      service={discoveryService}
                      token={token}
                      profile={profile}
                    />
                  ) : null}
                  {profile.role === 'coach' ? (
                    <CoachPublicCard
                      token={token}
                      coachId={profile.id}
                      service={coachRepository}
                    />
                  ) : null}
                  <ConnectionPanel
                    token={token}
                    service={connectionsService}
                    viewer={viewer}
                    profile={{
                      id: profile.id,
                      name: profile.fullName,
                      role: profile.role,
                    }}
                  />
                </>
              ) : null
            }
          />
        )}
      </DiscoveryStack.Screen>
    </DiscoveryStack.Navigator>
  );
}

// Keşif: a coach's scouting page; a player opens with the İzleme listesi star.
function ScoutNavigator() {
  const { token, user } = useAuth();
  if (!token || !user || user.role !== 'coach') return null;
  const viewer = { role: user.role, verified: user.verified };
  return (
    <ScoutStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <ScoutStack.Screen name="ScoutHome">
        {({ navigation }) => (
          <ScoutScreen
            service={discoveryService}
            token={token}
            onOpen={id => navigation.navigate('ScoutProfile', { id })}
          />
        )}
      </ScoutStack.Screen>
      <ScoutStack.Screen name="ScoutProfile">
        {({ navigation, route }) => (
          <DiscoveryProfileScreen
            usePostsSlot={useDiscoveryPostsSlot}
            service={discoveryService}
            token={token}
            kind="players"
            id={route.params.id}
            onBack={() => navigation.goBack()}
            renderConnection={profile => (
              <>
                <WatchButton
                  service={discoveryService}
                  token={token}
                  profile={profile}
                />
                <ConnectionPanel
                  token={token}
                  service={connectionsService}
                  viewer={viewer}
                  profile={{
                    id: profile.id,
                    name: profile.fullName,
                    role: profile.role,
                  }}
                />
              </>
            )}
          />
        )}
      </ScoutStack.Screen>
    </ScoutStack.Navigator>
  );
}

// The Profil tab. Settings stay in Diğer; the header shows the owner's real
// view and follow counts, refreshed whenever the tab gains focus.
function ProfileNavigator() {
  const { token, user } = useAuth();
  const pro = useProStatus(proService, token);
  const account = useAccountProfile(accountRepository, token);
  const avatar = account.profile
    ? avatarUrl(account.profile.id, account.profile.avatarVersion)
    : '';
  const [counts, setCounts] = useState<ProfileCounts | null>(null);
  useFocusEffect(
    useCallback(() => {
      let current = true;
      if (token)
        discoveryService
          .insights(token)
          .then(value => {
            if (current)
              setCounts({
                views: value.profileViews,
                followers: value.followers,
                following: value.following,
              });
          })
          .catch(() => undefined);
      return () => {
        current = false;
      };
    }, [token]),
  );
  if (!user) {
    return null;
  }
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <ProfileStack.Screen name="ProfileHome">
        {({ navigation }) =>
          user.role === 'player' ? (
            <OwnPlayerProfile
              navigation={navigation}
              userId={user.id}
              fullName={account.profile?.fullName ?? user.fullName}
              avatar={avatar}
              isPro={pro.isPro}
              counts={counts}
            />
          ) : user.role === 'coach' && token ? (
            <OwnCoachProfile
              navigation={navigation}
              token={token}
              userId={user.id}
              fullName={account.profile?.fullName ?? user.fullName}
              avatar={avatar}
              verified={user.verified}
              isPro={pro.isPro}
              counts={counts}
            />
          ) : (
            <AccountScreen
              settings={false}
              avatarUri={avatar}
              onEditProfile={() => navigation.navigate('AccountProfile')}
            />
          )
        }
      </ProfileStack.Screen>
      <ProfileStack.Screen name="PostThread">
        {({ navigation, route }) =>
          token ? (
            <SocialThreadScreen
              token={token}
              name={user.fullName}
              id={route.params.id}
              service={socialService}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
      </ProfileStack.Screen>
      <ProfileStack.Screen
        name="PostPublish"
        options={{ gestureEnabled: false }}
      >
        {({ navigation }) =>
          token ? (
            <SocialPublishScreen
              token={token}
              name={user.fullName}
              profileOption={user.role === 'player'}
              service={socialService}
              onBack={() => navigation.goBack()}
              onPublished={() => navigation.popTo('ProfileHome')}
            />
          ) : null
        }
      </ProfileStack.Screen>
      <ProfileStack.Screen name="AccountProfile">
        {({ navigation }) =>
          token ? (
            <AccountProfileScreen
              token={token}
              repository={accountRepository}
              onChange={account.setProfile}
              onBack={() => navigation.goBack()}
              onFootball={
                user.role === 'player'
                  ? () => navigation.navigate('PlayerProfile')
                  : user.role === 'coach'
                  ? () => navigation.navigate('CoachProfile')
                  : undefined
              }
              footballLink={
                user.role === 'coach'
                  ? {
                      title: copy.coaches.editTitle,
                      hint: copy.coaches.editHint,
                    }
                  : undefined
              }
            />
          ) : null
        }
      </ProfileStack.Screen>
      <ProfileStack.Screen name="CoachProfile">
        {({ navigation }) =>
          token ? (
            <CoachProfileEditScreen
              token={token}
              service={coachRepository}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
      </ProfileStack.Screen>
      <ProfileStack.Screen name="PlayerProfile">
        {({ navigation }) => (
          <PlayerProfileScreen
            token={token}
            onBack={() => navigation.goBack()}
          />
        )}
      </ProfileStack.Screen>
    </ProfileStack.Navigator>
  );
}
// The player's own profile with the Gönderiler tab; posts open and are
// written inside the Profil stack so Back returns here.
function OwnPlayerProfile({
  navigation,
  userId,
  fullName,
  avatar,
  isPro,
  counts,
}: {
  navigation: NativeStackNavigationProp<ProfileRoutes, 'ProfileHome'>;
  userId: string;
  fullName: string;
  avatar: string;
  isPro: boolean;
  counts: ProfileCounts | null;
}) {
  const { token } = useAuth();
  const posts = useProfilePostsSlot({
    service: socialService,
    token,
    userId,
    onOpen: id => navigation.navigate('PostThread', { id }),
    onCompose: () => navigation.navigate('PostPublish'),
  });
  return (
    <PlayerOverviewScreen
      fullName={fullName}
      isPro={isPro}
      token={token}
      service={playerProfileService}
      userId={userId}
      media={playerMediaService}
      avatarUri={avatar}
      sharer={profileSharer}
      onEdit={() => navigation.navigate('AccountProfile')}
      counts={counts}
      posts={posts}
    />
  );
}
// The coach's own profile; posts open and are written inside the Profil stack.
function OwnCoachProfile({
  navigation,
  token,
  userId,
  fullName,
  avatar,
  verified,
  isPro,
  counts,
}: {
  navigation: NativeStackNavigationProp<ProfileRoutes, 'ProfileHome'>;
  token: string;
  userId: string;
  fullName: string;
  avatar: string;
  verified: boolean;
  isPro: boolean;
  counts: ProfileCounts | null;
}) {
  const posts = useProfilePostsSlot({
    service: socialService,
    token,
    userId,
    onOpen: id => navigation.navigate('PostThread', { id }),
    onCompose: () => navigation.navigate('PostPublish'),
  });
  return (
    <CoachOverviewScreen
      token={token}
      userId={userId}
      service={coachRepository}
      fullName={fullName}
      avatarUri={avatar}
      verified={verified}
      isPro={isPro}
      counts={counts}
      onEdit={() => navigation.navigate('AccountProfile')}
      onEditCoach={() => navigation.navigate('CoachProfile')}
      posts={posts?.postsTab}
    />
  );
}
// Other players' profiles (discovery) list their posts too; a post opens in
// the Sosyal tab.
function useDiscoveryPostsSlot(userId: string) {
  const { token } = useAuth();
  return useProfilePostsSlot({
    service: socialService,
    token,
    userId,
    onOpen: id =>
      navigationRef.navigate('Social', {
        screen: 'SocialThread',
        params: { id },
        initial: false,
      }),
  });
}
// The Social feed with its header shortcuts; requests, discovery and visitors
// live in the More stack and open on top of it.
function SocialFeedRoute({
  token,
  publishedAt,
  onOpen,
  onCompose,
  onRequests,
  onOpenProfile,
  onVisitors,
  onUpgrade,
}: {
  token: string;
  publishedAt?: number;
  onOpen(id: string): void;
  onCompose(): void;
  onRequests(): void;
  onOpenProfile(kind: DiscoveryKind, id: string): void;
  onVisitors(): void;
  onUpgrade(): void;
}) {
  const { user, delegate } = useAuth();
  const requests = useIncomingCount(connectionsService, token);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <SocialFeedScreen
        token={token}
        service={socialService}
        publishedAt={publishedAt}
        onOpen={onOpen}
        onCompose={onCompose}
        requestCount={requests.count}
        requestsLoadedAt={requests.loadedAt}
        onRequests={delegate ? undefined : onRequests}
        onMenu={() => setMenuOpen(true)}
      />
      <SocialSidebar
        visible={menuOpen}
        token={token}
        role={user?.role ?? 'player'}
        discovery={discoveryService}
        pro={proService}
        onClose={() => setMenuOpen(false)}
        onOpenProfile={onOpenProfile}
        onVisitors={onVisitors}
        onUpgrade={onUpgrade}
      />
    </>
  );
}

function SocialNavigator() {
  const { token, user } = useAuth();
  if (!token || !user) return null;
  return (
    <SocialStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <SocialStack.Screen name="SocialFeed">
        {({ navigation, route }) => (
          <SocialFeedRoute
            token={token}
            publishedAt={route.params?.publishedAt}
            onOpen={id => navigation.navigate('SocialThread', { id })}
            onCompose={() => navigation.navigate('SocialPublish')}
            onRequests={() => navigation.navigate('SocialConnections')}
            onOpenProfile={(kind, id) =>
              navigation.navigate('SocialDiscover', {
                screen: 'DiscoveryProfile',
                params: { kind, id },
                initial: false,
              })
            }
            onVisitors={() => navigation.navigate('SocialVisitors')}
            onUpgrade={() =>
              (
                navigation.getParent() as
                  | BottomTabNavigationProp<MainRoutes>
                  | undefined
              )?.navigate('More', { screen: 'Pro', initial: false })
            }
          />
        )}
      </SocialStack.Screen>
      <SocialStack.Screen
        name="SocialPublish"
        options={{ gestureEnabled: false }}
      >
        {({ navigation }) => (
          <SocialPublishScreen
            token={token}
            name={user.fullName}
            profileOption={user.role === 'player'}
            service={socialService}
            onBack={() => navigation.goBack()}
            onPublished={() =>
              navigation.popTo('SocialFeed', { publishedAt: Date.now() })
            }
          />
        )}
      </SocialStack.Screen>
      <SocialStack.Screen name="SocialConnections">
        {({ navigation }) => (
          <ConnectionsScreen
            token={token}
            service={connectionsService}
            onBack={() => navigation.goBack()}
            onDiscover={() => navigation.navigate('SocialDiscover')}
          />
        )}
      </SocialStack.Screen>
      <SocialStack.Screen name="SocialDiscover">
        {({ navigation }) => (
          <DiscoveryNavigator onBack={() => navigation.goBack()} />
        )}
      </SocialStack.Screen>
      <SocialStack.Screen name="SocialVisitors">
        {({ navigation }) => (
          <VisitorsScreen
            token={token}
            service={proService}
            onBack={() => navigation.goBack()}
            onUpgrade={() =>
              (
                navigation.getParent() as
                  | BottomTabNavigationProp<MainRoutes>
                  | undefined
              )?.navigate('More', { screen: 'Pro', initial: false })
            }
            onOpenProfile={(kind, id) =>
              navigation.navigate('SocialDiscover', {
                screen: 'DiscoveryProfile',
                params: { kind, id },
                initial: false,
              })
            }
          />
        )}
      </SocialStack.Screen>
      <SocialStack.Screen name="SocialThread">
        {({ navigation, route }) => (
          <SocialThreadScreen
            token={token}
            name={user.fullName}
            id={route.params.id}
            service={socialService}
            onBack={() => navigation.goBack()}
          />
        )}
      </SocialStack.Screen>
    </SocialStack.Navigator>
  );
}
function LeaguesNavigator() {
  const { token, user } = useAuth();
  // Clubs get Maçlarım; their crest is the account photo.
  const club = user?.role === 'club';
  const account = useAccountProfile(accountRepository, club ? token : null);
  if (!token) return null;
  return (
    <LeaguesStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <LeaguesStack.Screen name="LeaguesHome">
        {({ navigation }) => (
          <LeaguesHomeScreen
            token={token}
            footballService={footballService}
            clubMatches={
              club ? (
                <ClubMatchesView
                  token={token}
                  service={clubService}
                  clubName={user.fullName}
                  avatarUri={
                    account.profile
                      ? avatarUrl(
                          account.profile.id,
                          account.profile.avatarVersion,
                        ) || undefined
                      : undefined
                  }
                  onLinkTff={
                    !user.delegate ||
                    user.delegate.permissions.includes('profile')
                      ? () =>
                          (
                            navigation.getParent() as
                              | BottomTabNavigationProp<MainRoutes>
                              | undefined
                          )?.navigate('More', {
                            screen: 'ClubTffLink',
                            initial: false,
                          })
                      : undefined
                  }
                />
              ) : undefined
            }
            onOpenCompetition={competition =>
              navigation.navigate('Competition', { competition })
            }
            onOpenAnkara={() => navigation.navigate('Ankara')}
            onOpenLeague={league =>
              navigation.navigate('LeagueDetail', { id: league.id })
            }
            onSearch={() => navigation.navigate('Search')}
          />
        )}
      </LeaguesStack.Screen>
      <LeaguesStack.Screen name="Search">
        {({ navigation }) => (
          <LeaguesSearchScreen
            token={token}
            footballService={footballService}
            discoveryService={discoveryService}
            onBack={() => navigation.goBack()}
            onOpenCompetition={competition =>
              navigation.navigate('Competition', { competition })
            }
            onOpenAnkara={() => navigation.navigate('Ankara')}
            onOpenLeague={league =>
              navigation.navigate('LeagueDetail', { id: league.id })
            }
            onOpenTeam={id =>
              (
                navigation.getParent() as
                  | BottomTabNavigationProp<MainRoutes>
                  | undefined
              )?.navigate('Teams', { open: { id, at: Date.now() } })
            }
            onOpenPlayer={id =>
              (
                navigation.getParent() as
                  | BottomTabNavigationProp<MainRoutes>
                  | undefined
              )?.navigate('More', {
                screen: 'Discover',
                params: {
                  screen: 'DiscoveryProfile',
                  params: { kind: 'players', id },
                },
                initial: false,
              })
            }
          />
        )}
      </LeaguesStack.Screen>
      <LeaguesStack.Screen name="Competition">
        {({ navigation, route }) => (
          <CompetitionScreen
            key={route.params.competition.slug}
            token={token}
            service={footballService}
            competition={route.params.competition}
            onBack={() => navigation.goBack()}
          />
        )}
      </LeaguesStack.Screen>
      <LeaguesStack.Screen name="Ankara">
        {({ navigation }) => (
          <AnkaraScreen
            token={token}
            service={footballService}
            onBack={() => navigation.goBack()}
          />
        )}
      </LeaguesStack.Screen>
      <LeaguesStack.Screen name="LeagueDetail">
        {({ navigation, route }) => (
          <LeagueDetailScreen
            token={token}
            id={route.params.id}
            onBack={() => navigation.goBack()}
          />
        )}
      </LeaguesStack.Screen>
    </LeaguesStack.Navigator>
  );
}
function NewsNavigator({ onBack }: { onBack(): void }) {
  const { token } = useAuth();
  return (
    <NewsStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <NewsStack.Screen name="NewsList">
        {({ navigation }) => (
          <NewsScreen
            service={contentService}
            token={token}
            onOpen={id => navigation.navigate('NewsDetail', { id })}
            onBack={onBack}
          />
        )}
      </NewsStack.Screen>
      <NewsStack.Screen name="NewsDetail">
        {({ navigation, route }) => (
          <NewsDetailScreen
            service={contentService}
            token={token}
            id={route.params.id}
            onBack={() => navigation.goBack()}
          />
        )}
      </NewsStack.Screen>
    </NewsStack.Navigator>
  );
}

export function AppNavigator() {
  const { user, admin, restoring, restoreError, retryRestore } = useAuth();
  if (restoring || restoreError) {
    return (
      <View style={styles.startup}>
        {/* Same size and place as the native launch logo, so the hand-over is seamless. */}
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={copy.brand}
        >
          <Wordmark
            height={
              (launchWordmarkWidth * wordmarkSize.height) / wordmarkSize.width
            }
          />
        </View>
        <View style={styles.startupStatus}>
          {restoring ? (
            <ActivityIndicator
              color={colors.brand}
              accessibilityLabel={copy.form.loading}
            />
          ) : (
            <>
              <ErrorBanner message={restoreError} />
              <Button label={copy.form.retry} onPress={retryRestore} />
            </>
          )}
        </View>
      </View>
    );
  }
  // Keyed by account: the container keeps navigation state across its
  // children, so a switch to or from a club account must start a fresh tree
  // on its own Ana Sayfa instead of restoring the other account's screens.
  return (
    <NavigationContainer
      key={admin ? 'admin' : user?.id ?? 'guest'}
      theme={theme}
      ref={navigationRef}
    >
      {admin ? <AdminNavigator /> : user ? <MainTabs /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: colors.bg },
  startup: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startupStatus: {
    position: 'absolute',
    top: '50%',
    left: space.xxl,
    right: space.xxl,
    marginTop: space.xxxl,
    gap: space.xl,
  },
});
