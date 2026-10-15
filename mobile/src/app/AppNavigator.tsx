import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { AccountScreen, useAuth } from '../features/auth';
import { BlockedUsersScreen, moderationService } from '../features/moderation';
import {
  DiscoverScreen,
  DiscoveryProfileScreen,
  createDiscoveryService,
  discoveryRepository,
  type DiscoveryKind,
} from '../features/discovery';
import {
  createContentService,
  contentRepository,
  NewsScreen,
  NewsDetailScreen,
} from '../features/content';
import {
  ConnectionPanel,
  ConnectionsScreen,
  connectionsRepository,
  createConnectionsService,
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
  ClubProfileEditScreen,
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
  createTeamsService,
  teamsRepository,
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
} from '../features/players';
import { Medal } from 'lucide-react-native';
import { Brand } from '../shared/ui/Brand';
import { Button } from '../shared/ui/Button';
import { EmptyState } from '../shared/ui/EmptyState';
import { ErrorBanner } from '../shared/ui/ErrorBanner';
import { Screen } from '../shared/ui/Screen';
import { copy } from '../shared/lib/copy';
import { colors, space } from '../styles/tokens';
import { HomeScreen } from './HomeScreen';
import { LeaguesHomeScreen } from './LeaguesHomeScreen';
import { FutTabBar } from './FutTabBar';
import { MoreScreen } from './MoreScreen';
import { AdminNavigator } from './AdminNavigator';
import { AuthNavigator } from './AuthNavigator';

type MainRoutes = {
  Home: undefined;
  Leagues: NavigatorScreenParams<LeaguesRoutes> | undefined;
  Social: NavigatorScreenParams<SocialRoutes> | undefined;
  Teams: undefined;
  More: NavigatorScreenParams<MoreRoutes> | undefined;
};
type ProfileRoutes = {
  ProfileHome: undefined;
  PlayerProfile: undefined;
};
type DiscoveryRoutes = {
  DiscoveryList: undefined;
  DiscoveryProfile: { kind: DiscoveryKind; id: string };
};
type MoreRoutes = {
  MoreHome: undefined;
  Profile: NavigatorScreenParams<ProfileRoutes> | undefined;
  Account: undefined;
  BlockedUsers: undefined;
  Discover: NavigatorScreenParams<DiscoveryRoutes> | undefined;
  Connections: undefined;
  TeamJoinRequests: undefined;
  TeamApplications: undefined;
  TeamRights: undefined;
  Notifications: undefined;
  News: NavigatorScreenParams<NewsRoutes> | undefined;
  Gifts: undefined;
  ClubProfileEdit: undefined;
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
};
type LeaguesRoutes = {
  LeaguesHome: undefined;
  Competition: { competition: Competition };
  Ankara: undefined;
  LeagueDetail: { id: string };
};
type NewsRoutes = { NewsList: undefined; NewsDetail: { id: string } };
type SocialRoutes = {
  SocialFeed: { publishedAt?: number } | undefined;
  SocialThread: { id: string };
  SocialPublish: undefined;
};
const SocialStack = createNativeStackNavigator<SocialRoutes>();
const NewsStack = createNativeStackNavigator<NewsRoutes>();
const LeaguesStack = createNativeStackNavigator<LeaguesRoutes>();
const footballService = createFootballService(footballRepository);
const contentService = createContentService(contentRepository);
const Tabs = createBottomTabNavigator<MainRoutes>();
const ProfileStack = createNativeStackNavigator<ProfileRoutes>();
const DiscoveryStack = createNativeStackNavigator<DiscoveryRoutes>();
const MoreStack = createNativeStackNavigator<MoreRoutes>();
const discoveryService = createDiscoveryService(discoveryRepository);
const playerProfileService = createPlayerProfileService(
  playerProfileRepository,
);
const navigationRef = createNavigationContainerRef<MainRoutes>();
const openNotifications = () => {
  if (navigationRef.isReady())
    navigationRef.navigate('More', { screen: 'Notifications' });
};
const notificationsService = createNotificationsService(
  notificationsRepository,
);
const socialService = createSocialService(socialRepository);
const giftsService = createGiftsService(giftsRepository);
const connectionsService = createConnectionsService(connectionsRepository);
const clubService = createClubService(clubRepository);
const teamsService = createTeamsService(teamsRepository);
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
function renderTabBar(props: BottomTabBarProps) {
  const route = props.state.routes[props.state.index];
  if (
    route.name === 'Social' &&
    getFocusedRouteNameFromRoute(route) === 'SocialPublish'
  )
    return null;
  return <FutTabBar {...props} />;
}
function MainTabs() {
  const { user, token } = useAuth();
  useStoreRecovery(storeCheckout, token);
  usePushRegistration(pushMessaging, pushRepository, token, openNotifications);
  return (
    <Tabs.Navigator
      tabBar={renderTabBar}
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
              teamsService={teamsService}
              discoveryService={discoveryService}
              onProfile={() =>
                navigation.navigate('More', {
                  screen: 'ClubProfileEdit',
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
              contentService={contentService}
              discoveryService={discoveryService}
              giftsService={giftsService}
              onProfile={() =>
                navigation.navigate('More', {
                  screen: 'Profile',
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
      <Tabs.Screen
        name="Social"
        component={SocialNavigator}
        options={{ popToTopOnBlur: true }}
      />
      <Tabs.Screen name="Teams">
        {({ navigation }) => (
          <TeamsScreen
            onOpenRights={() =>
              navigation.navigate('More', {
                screen: 'TeamRights',
                initial: false,
              })
            }
          />
        )}
      </Tabs.Screen>
      <Tabs.Screen
        name="More"
        component={MoreNavigator}
        options={{ popToTopOnBlur: true }}
      />
    </Tabs.Navigator>
  );
}

function MoreNavigator() {
  const { token, user } = useAuth();
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
            token={token}
            isClub={user?.role === 'club'}
            isPlayer={user?.role === 'player'}
            isOrganizer={!member}
          />
        )}
      </MoreStack.Screen>
      <MoreStack.Screen name="News">
        {({ navigation }) => (
          <NewsNavigator onBack={() => navigation.goBack()} />
        )}
      </MoreStack.Screen>
      <MoreStack.Screen name="Profile">
        {({ navigation }) =>
          member ? (
            <ProfileNavigator
              onAccount={() => navigation.navigate('Account')}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
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
      <MoreStack.Screen name="Notifications">
        {({ navigation }) =>
          token ? (
            <NotificationsScreen
              token={token}
              service={notificationsService}
              onBack={() => navigation.goBack()}
              onOpenGifts={() => navigation.navigate('Gifts')}
              onOpenConnections={() => navigation.navigate('Connections')}
              onOpenListing={id =>
                // Opportunity notifications also come from admin announcements;
                // only an open listing is opened, otherwise the card just marks read.
                listingsService
                  .findOpen(token, id)
                  .then(listing => {
                    if (listing) navigation.navigate('ListingDetail', { id });
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
                        navigation.navigate('OrganizerTournament', {
                          id: tournament.id,
                        });
                      } else {
                        navigation.getParent()?.navigate('Home');
                      }
                    } else if (tournament) {
                      navigation.navigate('TournamentDetail', {
                        id: tournament.id,
                      });
                    } else if (user?.role === 'club') {
                      navigation.navigate('TournamentEntries');
                    }
                  })
                  .catch(() => undefined)
              }
            />
          ) : null
        }
      </MoreStack.Screen>
    </MoreStack.Navigator>
  );
}

function MoreHomeRoute({
  navigation,
  token,
  isClub,
  isPlayer,
  isOrganizer,
}: {
  navigation: NativeStackNavigationProp<MoreRoutes, 'MoreHome'>;
  token: string | null;
  isClub: boolean;
  isPlayer: boolean;
  isOrganizer: boolean;
}) {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      let current = true;
      if (!token) {
        setUnreadCount(null);
        return () => {
          current = false;
        };
      }
      notificationsService
        .unreadCount(token)
        .then(value => {
          if (current) setUnreadCount(value);
        })
        .catch(() => {
          if (current) setUnreadCount(null);
        });
      return () => {
        current = false;
      };
    }, [token]),
  );
  return (
    <MoreScreen
      onProfile={() => navigation.navigate('Profile')}
      onSettings={() => navigation.navigate('Account')}
      onDiscover={() => navigation.navigate('Discover')}
      onConnections={() => navigation.navigate('Connections')}
      onTeamRequests={() => navigation.navigate('TeamJoinRequests')}
      onMyTeamApplications={() => navigation.navigate('TeamApplications')}
      onBuyTeamRights={() => navigation.navigate('TeamRights')}
      onNotifications={() => navigation.navigate('Notifications')}
      onNews={() => navigation.navigate('News')}
      onGifts={() => navigation.navigate('Gifts')}
      onSquad={() => navigation.navigate('Squad')}
      onClubListings={() => navigation.navigate('ClubListings')}
      onListings={() => navigation.navigate('Listings')}
      onMemberships={() => navigation.navigate('Memberships')}
      onTournaments={() => navigation.navigate('Tournaments')}
      onTournamentEntries={() => navigation.navigate('TournamentEntries')}
      onVisitors={() => navigation.navigate('Visitors')}
      unreadCount={unreadCount}
      isClub={isClub}
      isPlayer={isPlayer}
      isOrganizer={isOrganizer}
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
            service={discoveryService}
            token={token}
            kind={route.params.kind}
            id={route.params.id}
            onBack={() => navigation.goBack()}
            renderConnection={profile =>
              token ? (
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
              ) : null
            }
          />
        )}
      </DiscoveryStack.Screen>
    </DiscoveryStack.Navigator>
  );
}

function ProfileNavigator({
  onAccount,
  onBack,
}: {
  onAccount(): void;
  onBack(): void;
}) {
  const { token, user } = useAuth();
  const pro = useProStatus(proService, token);
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
            <PlayerOverviewScreen
              fullName={user.fullName}
              isPro={pro.isPro}
              token={token}
              service={playerProfileService}
              userId={user.id}
              media={playerMediaService}
              onEdit={() => navigation.navigate('PlayerProfile')}
              onAccount={onAccount}
              onBack={onBack}
            />
          ) : (
            <AccountScreen onBack={onBack} settings={false} />
          )
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
// The social API rejects organizer accounts, so their Sosyal tab explains it
// instead of showing a failing feed (this also hides the Oyunlar tab).
function OrganizerSocialNotice() {
  return (
    <Screen>
      <EmptyState
        icon={Medal}
        title={copy.tournaments.socialUnavailableTitle}
        body={copy.tournaments.socialUnavailableBody}
      />
    </Screen>
  );
}
function SocialNavigator() {
  const { token, user } = useAuth();
  if (!token || !user) return null;
  if (user.role === 'organizer') return <OrganizerSocialNotice />;
  return (
    <SocialStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <SocialStack.Screen name="SocialFeed">
        {({ navigation, route }) => (
          <SocialFeedScreen
            token={token}
            service={socialService}
            publishedAt={route.params?.publishedAt}
            onOpen={id => navigation.navigate('SocialThread', { id })}
            onCompose={() => navigation.navigate('SocialPublish')}
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
            service={socialService}
            onBack={() => navigation.goBack()}
            onPublished={() =>
              navigation.popTo('SocialFeed', { publishedAt: Date.now() })
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
  const { token } = useAuth();
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
            onOpenCompetition={competition =>
              navigation.navigate('Competition', { competition })
            }
            onOpenAnkara={() => navigation.navigate('Ankara')}
            onOpenLeague={league =>
              navigation.navigate('LeagueDetail', { id: league.id })
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
        <Brand />
        {restoring ? (
          <>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.loading}>{copy.form.loading}</Text>
          </>
        ) : (
          <>
            <ErrorBanner message={restoreError} />
            <Button label={copy.form.retry} onPress={retryRestore} />
          </>
        )}
      </View>
    );
  }
  return (
    <NavigationContainer theme={theme} ref={navigationRef}>
      {admin ? <AdminNavigator /> : user ? <MainTabs /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
const styles = StyleSheet.create({
  startup: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: space.xxl,
    gap: space.xl,
    alignItems: 'stretch',
  },
  loading: { textAlign: 'center', color: colors.secondary, fontSize: 13 },
});
