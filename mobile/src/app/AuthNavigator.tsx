import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  SignInScreen,
  SignUpScreen,
  AccountTypeScreen,
  ApplicationScreen,
  type ApplicationRole,
  type SignUpRole,
} from '../features/auth';
import {
  OnboardingScreen,
  onboardingStorage,
  useOnboarding,
  type OnboardingStorage,
} from '../features/onboarding';
import { useReducedMotion } from '../shared/lib/useReducedMotion';
import { colors } from '../styles/tokens';

type AuthRoutes = {
  Onboarding: undefined;
  OnboardingInfo: undefined;
  SignIn: undefined;
  AccountType: undefined;
  SignUp: { role: SignUpRole } | undefined;
  Application: { role: ApplicationRole };
};
const Stack = createNativeStackNavigator<AuthRoutes>();

// Signed-out flow. The intro opens first only until it has been seen once;
// sign-up screens can reopen it as an info sheet.
export function AuthNavigator({
  storage = onboardingStorage,
}: {
  storage?: OnboardingStorage;
}) {
  const onboarding = useOnboarding(storage);
  const reducedMotion = useReducedMotion();
  if (!onboarding.ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  return (
    <Stack.Navigator
      initialRouteName={onboarding.seen ? 'SignIn' : 'Onboarding'}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: reducedMotion ? 'none' : 'fade_from_bottom',
      }}
    >
      <Stack.Screen name="Onboarding">
        {({ navigation }) => (
          <OnboardingScreen
            mode="intro"
            onSignIn={() => {
              onboarding.complete();
              navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
            }}
            onSignUp={() => {
              onboarding.complete();
              navigation.reset({
                index: 1,
                routes: [{ name: 'SignIn' }, { name: 'AccountType' }],
              });
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="SignIn">
        {({ navigation }) => (
          <SignInScreen onSignUp={() => navigation.navigate('AccountType')} />
        )}
      </Stack.Screen>
      <Stack.Screen name="AccountType">
        {({ navigation }) => (
          <AccountTypeScreen
            onBack={() => navigation.goBack()}
            onInfo={() => navigation.navigate('OnboardingInfo')}
            onSelect={kind =>
              kind === 'player' || kind === 'coach'
                ? navigation.navigate('SignUp', { role: kind })
                : navigation.navigate('Application', { role: kind })
            }
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="SignUp">
        {({ navigation, route }) => (
          <SignUpScreen
            role={route.params?.role}
            onBack={() => navigation.goBack()}
            onInfo={() => navigation.navigate('OnboardingInfo')}
            onSignIn={() => navigation.popTo('SignIn')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Application">
        {({ navigation, route }) => (
          <ApplicationScreen
            role={route.params.role}
            onBack={() => navigation.goBack()}
            onSignIn={() => navigation.popTo('SignIn')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="OnboardingInfo"
        options={{
          presentation: 'fullScreenModal',
          animation: reducedMotion ? 'none' : 'slide_from_bottom',
        }}
      >
        {({ navigation }) => (
          <OnboardingScreen mode="info" onClose={() => navigation.goBack()} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
