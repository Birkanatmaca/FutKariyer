import React, { useMemo } from 'react';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import {
  ClipboardCheck,
  Ellipsis,
  LayoutDashboard,
  Newspaper,
  Users,
} from 'lucide-react-native';
import { useAuth } from '../features/auth';
import {
  AccountEditorScreen,
  AccountsScreen,
  AdminDashboardScreen,
  AdminGiftsScreen,
  AdminMoreScreen,
  AdminPaymentsScreen,
  AnnouncementsScreen,
  ApplicationsScreen,
  ClubOverviewScreen,
  ContentEditorScreen,
  ContentScreen,
  LeagueEditorScreen,
  LeaguesScreen,
  LeagueWorkspaceScreen,
  MatchEditorScreen,
  createAdminGateway,
  createAdminRepositories,
  createAdminServices,
  pickContentImage,
  type AccountSection,
  type AdminDestination,
  type AdminServices,
  type ContentItem,
  type ContentSection,
  type ContentTab,
  type League,
  type LeagueMatch,
  type LeagueTeam,
} from '../features/admin';
import { copy } from '../shared/lib/copy';
import { colors } from '../styles/tokens';
import { FutTabBar } from './FutTabBar';

// Admin mode replaces the user tabs when the session is an admin session.
type AdminTabRoutes = {
  Panel: undefined;
  Accounts: NavigatorScreenParams<AccountsRoutes> | undefined;
  Applications: undefined;
  Content: NavigatorScreenParams<ContentRoutes> | undefined;
  More: NavigatorScreenParams<AdminMoreRoutes> | undefined;
};
// changedAt/notice come back from an editor: reload the list, show the result.
type Changed = { changedAt?: number; notice?: string };
type AccountsRoutes = {
  AccountsList: ({ section?: AccountSection } & Changed) | undefined;
  AccountEditor: { section: AccountSection; id?: string };
  ClubOverview: { id: string; name: string };
};
type ContentRoutes = {
  ContentHome: ({ tab?: ContentTab } & Changed) | undefined;
  ContentEditor: { section: ContentSection; item?: ContentItem };
};
type AdminMoreRoutes = {
  MoreHome: undefined;
  Leagues: Changed | undefined;
  LeagueEditor: { league?: League };
  LeagueWorkspace: { id: string } & Changed;
  MatchEditor: { leagueId: string; teams: LeagueTeam[]; match?: LeagueMatch };
  Gifts: undefined;
  Announcements: undefined;
  Payments: undefined;
};
const Tabs = createBottomTabNavigator<AdminTabRoutes>();
const AccountsStack = createNativeStackNavigator<AccountsRoutes>();
const ContentStack = createNativeStackNavigator<ContentRoutes>();
const MoreStack = createNativeStackNavigator<AdminMoreRoutes>();
const stackOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.bg },
};
const adminIcons = {
  Panel: LayoutDashboard,
  Accounts: Users,
  Applications: ClipboardCheck,
  Content: Newspaper,
  More: Ellipsis,
};
function renderAdminTabBar(props: BottomTabBarProps) {
  return <FutTabBar {...props} icons={adminIcons} labels={copy.admin.tabs} />;
}
type TabNavigation = {
  navigate(...args: unknown[]): void;
};
// Dashboard and menu shortcuts into every admin section.
function openDestination(navigation: TabNavigation, to: AdminDestination) {
  switch (to) {
    case 'users':
    case 'clubs':
      navigation.navigate('Accounts', {
        screen: 'AccountsList',
        params: { section: to },
      });
      return;
    case 'applications':
      navigation.navigate('Applications');
      return;
    case 'ads':
    case 'news':
    case 'reviews':
      navigation.navigate('Content', {
        screen: 'ContentHome',
        params: { tab: to },
      });
      return;
    default:
      navigation.navigate('More', {
        screen:
          to === 'leagues'
            ? 'Leagues'
            : to === 'gifts'
            ? 'Gifts'
            : to === 'announcements'
            ? 'Announcements'
            : 'Payments',
        initial: false,
      });
  }
}

export function AdminNavigator() {
  const { admin, adminToken, expireAdminSession, signOut } = useAuth();
  // The gateway only knows the admin token; a 401 ends the admin session.
  const services = useMemo(
    () =>
      createAdminServices(
        createAdminRepositories(
          createAdminGateway({
            token: () => adminToken,
            onUnauthorized: () => {
              expireAdminSession();
            },
          }),
        ),
        pickContentImage,
      ),
    [adminToken, expireAdminSession],
  );
  if (!admin) return null;
  return (
    <Tabs.Navigator
      tabBar={renderAdminTabBar}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="Panel">
        {({ navigation }) => (
          <AdminDashboardScreen
            services={services}
            name={admin.fullName}
            onOpen={to => openDestination(navigation, to)}
          />
        )}
      </Tabs.Screen>
      <Tabs.Screen name="Accounts" options={{ popToTopOnBlur: true }}>
        {() => <AccountsNavigator services={services} />}
      </Tabs.Screen>
      <Tabs.Screen name="Applications">
        {() => <ApplicationsScreen services={services} />}
      </Tabs.Screen>
      <Tabs.Screen name="Content" options={{ popToTopOnBlur: true }}>
        {() => <ContentNavigator services={services} />}
      </Tabs.Screen>
      <Tabs.Screen name="More" options={{ popToTopOnBlur: true }}>
        {({ navigation }) => (
          <MoreNavigator
            services={services}
            name={admin.fullName}
            email={admin.email}
            onOpen={to => openDestination(navigation, to)}
            onSignOut={signOut}
          />
        )}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
}

function AccountsNavigator({ services }: { services: AdminServices }) {
  return (
    <AccountsStack.Navigator screenOptions={stackOptions}>
      <AccountsStack.Screen name="AccountsList">
        {({ navigation, route }) => (
          <AccountsScreen
            services={services}
            section={route.params?.section ?? 'users'}
            changedAt={route.params?.changedAt}
            notice={route.params?.notice}
            onSection={section =>
              navigation.setParams({ section, notice: undefined })
            }
            onCreate={section =>
              navigation.navigate('AccountEditor', { section })
            }
            onEdit={account =>
              navigation.navigate('AccountEditor', {
                section: route.params?.section ?? 'users',
                id: account.id,
              })
            }
            onOverview={account =>
              navigation.navigate('ClubOverview', {
                id: account.id,
                name: account.fullName,
              })
            }
          />
        )}
      </AccountsStack.Screen>
      <AccountsStack.Screen name="AccountEditor">
        {({ navigation, route }) => (
          <AccountEditorScreen
            services={services}
            section={route.params.section}
            id={route.params.id}
            onBack={() => navigation.goBack()}
            onDone={notice =>
              navigation.popTo('AccountsList', {
                section: route.params.section,
                changedAt: Date.now(),
                notice,
              })
            }
          />
        )}
      </AccountsStack.Screen>
      <AccountsStack.Screen name="ClubOverview">
        {({ navigation, route }) => (
          <ClubOverviewScreen
            services={services}
            id={route.params.id}
            name={route.params.name}
            onBack={() => navigation.goBack()}
          />
        )}
      </AccountsStack.Screen>
    </AccountsStack.Navigator>
  );
}

function ContentNavigator({ services }: { services: AdminServices }) {
  return (
    <ContentStack.Navigator screenOptions={stackOptions}>
      <ContentStack.Screen name="ContentHome">
        {({ navigation, route }) => (
          <ContentScreen
            services={services}
            tab={route.params?.tab ?? 'ads'}
            changedAt={route.params?.changedAt}
            notice={route.params?.notice}
            onTab={tab => navigation.setParams({ tab, notice: undefined })}
            onCreate={section =>
              navigation.navigate('ContentEditor', { section })
            }
            onEdit={(section, item) =>
              navigation.navigate('ContentEditor', { section, item })
            }
          />
        )}
      </ContentStack.Screen>
      <ContentStack.Screen name="ContentEditor">
        {({ navigation, route }) => (
          <ContentEditorScreen
            services={services}
            section={route.params.section}
            item={route.params.item}
            onBack={() => navigation.goBack()}
            onDone={notice =>
              navigation.popTo('ContentHome', {
                tab: route.params.section,
                changedAt: Date.now(),
                notice,
              })
            }
          />
        )}
      </ContentStack.Screen>
    </ContentStack.Navigator>
  );
}

function MoreNavigator({
  services,
  name,
  email,
  onOpen,
  onSignOut,
}: {
  services: AdminServices;
  name: string;
  email: string;
  onOpen(to: AdminDestination): void;
  onSignOut(): Promise<void>;
}) {
  return (
    <MoreStack.Navigator screenOptions={stackOptions}>
      <MoreStack.Screen name="MoreHome">
        {() => (
          <AdminMoreScreen
            name={name}
            email={email}
            onOpen={onOpen}
            onSignOut={onSignOut}
          />
        )}
      </MoreStack.Screen>
      <MoreStack.Screen name="Leagues">
        {({ navigation, route }) => (
          <LeaguesScreen
            services={services}
            changedAt={route.params?.changedAt}
            notice={route.params?.notice}
            onBack={() => navigation.goBack()}
            onCreate={() => navigation.navigate('LeagueEditor', {})}
            onOpen={league =>
              navigation.navigate('LeagueWorkspace', { id: league.id })
            }
          />
        )}
      </MoreStack.Screen>
      <MoreStack.Screen name="LeagueEditor">
        {({ navigation, route }) => (
          <LeagueEditorScreen
            services={services}
            league={route.params.league}
            onBack={() => navigation.goBack()}
            onDone={(saved, notice) => {
              if (route.params.league) {
                navigation.popTo('LeagueWorkspace', {
                  id: saved.id,
                  changedAt: Date.now(),
                  notice,
                });
                return;
              }
              // A new league: refresh the list below, then open its workspace.
              navigation.popTo('Leagues', { changedAt: Date.now() });
              navigation.navigate('LeagueWorkspace', { id: saved.id, notice });
            }}
          />
        )}
      </MoreStack.Screen>
      <MoreStack.Screen name="LeagueWorkspace">
        {({ navigation, route }) => (
          <LeagueWorkspaceScreen
            services={services}
            id={route.params.id}
            changedAt={route.params.changedAt}
            notice={route.params.notice}
            onBack={() => navigation.goBack()}
            onEdit={league => navigation.navigate('LeagueEditor', { league })}
            onDeleted={notice =>
              navigation.popTo('Leagues', { changedAt: Date.now(), notice })
            }
            onMatch={(teams, match) =>
              navigation.navigate('MatchEditor', {
                leagueId: route.params.id,
                teams,
                match,
              })
            }
          />
        )}
      </MoreStack.Screen>
      <MoreStack.Screen name="MatchEditor">
        {({ navigation, route }) => (
          <MatchEditorScreen
            services={services}
            leagueId={route.params.leagueId}
            teams={route.params.teams}
            match={route.params.match}
            onBack={() => navigation.goBack()}
            onDone={notice =>
              navigation.popTo('LeagueWorkspace', {
                id: route.params.leagueId,
                changedAt: Date.now(),
                notice,
              })
            }
          />
        )}
      </MoreStack.Screen>
      <MoreStack.Screen name="Gifts">
        {({ navigation }) => (
          <AdminGiftsScreen
            services={services}
            onBack={() => navigation.goBack()}
          />
        )}
      </MoreStack.Screen>
      <MoreStack.Screen name="Announcements">
        {({ navigation }) => (
          <AnnouncementsScreen
            services={services}
            onBack={() => navigation.goBack()}
          />
        )}
      </MoreStack.Screen>
      <MoreStack.Screen name="Payments">
        {({ navigation }) => (
          <AdminPaymentsScreen
            services={services}
            onBack={() => navigation.goBack()}
          />
        )}
      </MoreStack.Screen>
    </MoreStack.Navigator>
  );
}
