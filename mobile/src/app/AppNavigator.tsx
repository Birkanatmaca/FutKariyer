import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  AccountScreen,
  SignInScreen,
  SignUpScreen,
  useAuth,
} from '../features/auth';
import { DiscoverScreen } from '../features/discovery';
import { ConnectionsScreen } from '../features/connections';
import { Brand } from '../shared/ui/Brand';
import { Button } from '../shared/ui/Button';
import { ErrorBanner } from '../shared/ui/ErrorBanner';
import { copy } from '../shared/lib/copy';
import { useReducedMotion } from '../shared/lib/useReducedMotion';
import { colors, space } from '../styles/tokens';
import { HomeScreen } from './HomeScreen';
import { FutTabBar } from './FutTabBar';

type AuthRoutes = { SignIn: undefined; SignUp: undefined };
type MainRoutes = {
  Home: undefined;
  Discover: undefined;
  Connections: undefined;
  Profile: undefined;
};
const Stack = createNativeStackNavigator<AuthRoutes>();
const Tabs = createBottomTabNavigator<MainRoutes>();
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
  return <FutTabBar {...props} />;
}
function MainTabs() {
  return (
    <Tabs.Navigator
      tabBar={renderTabBar}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="Home">
        {({ navigation }) => (
          <HomeScreen
            onProfile={() => navigation.navigate('Profile')}
            onDiscover={() => navigation.navigate('Discover')}
          />
        )}
      </Tabs.Screen>
      <Tabs.Screen name="Discover" component={DiscoverScreen} />
      <Tabs.Screen name="Connections">
        {({ navigation }) => (
          <ConnectionsScreen
            onDiscover={() => navigation.navigate('Discover')}
          />
        )}
      </Tabs.Screen>
      <Tabs.Screen name="Profile" component={AccountScreen} />
    </Tabs.Navigator>
  );
}
export function AppNavigator() {
  const { user, restoring, restoreError, retryRestore } = useAuth();
  const reducedMotion = useReducedMotion();
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
    <NavigationContainer theme={theme}>
      {user ? (
        <MainTabs />
      ) : (
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: reducedMotion ? 'none' : 'fade_from_bottom',
          }}
        >
          <Stack.Screen name="SignIn">
            {({ navigation }) => (
              <SignInScreen onSignUp={() => navigation.navigate('SignUp')} />
            )}
          </Stack.Screen>
          <Stack.Screen name="SignUp">
            {({ navigation }) => (
              <SignUpScreen onSignIn={() => navigation.goBack()} />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      )}
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
