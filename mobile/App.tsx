import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from './src/shared/ui/keyboard';
import {
  AuthProvider,
  authRepository,
  sessionStorage,
  clubSessionStorage,
} from './src/features/auth';
import { AppNavigator } from './src/app/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <KeyboardProvider>
        <AuthProvider
          repository={authRepository}
          storage={sessionStorage}
          clubStorage={clubSessionStorage}
        >
          <AppNavigator />
        </AuthProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
