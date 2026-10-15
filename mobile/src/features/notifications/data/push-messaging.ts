import { PermissionsAndroid, Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';
import type { PushMessaging, PushPlatform } from '../domain/push';

const platform: PushPlatform | null =
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : null;

// Firebase throws until the native config files are added; push then stays off.
function messaging() {
  try {
    return getMessaging(getApp());
  } catch {
    return null;
  }
}

async function permitted() {
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) < 33) return true;
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  const instance = messaging();
  if (!instance) return false;
  const status = await requestPermission(instance);
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL
  );
}

export const pushMessaging: PushMessaging = {
  platform,
  async requestToken() {
    const instance = messaging();
    if (!instance || !platform || !(await permitted())) return null;
    return getToken(instance);
  },
  onTokenRefresh(listener) {
    const instance = messaging();
    return instance ? onTokenRefresh(instance, listener) : () => {};
  },
  onOpened(listener) {
    const instance = messaging();
    return instance
      ? onNotificationOpenedApp(instance, () => listener())
      : () => {};
  },
  async openedFromPush() {
    const instance = messaging();
    return !!instance && !!(await getInitialNotification(instance));
  },
};
