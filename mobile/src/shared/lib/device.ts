import { Platform } from 'react-native';

// A short label for this phone on the Active sessions screen, e.g.
// "iPhone (iOS 18.2)" or "Pixel 8 (Android 15)". It travels in an HTTP
// header, so it stays ASCII. No identifier is sent.
export function deviceName(): string {
  let label = 'Web';
  if (Platform.OS === 'ios') {
    const kind = Platform.isPad ? 'iPad' : 'iPhone';
    label = Platform.Version
      ? kind + ' (iOS ' + String(Platform.Version) + ')'
      : kind;
  } else if (Platform.OS === 'android') {
    const constants = Platform.constants as {
      Model?: string;
      Release?: string;
    };
    const model = constants.Model?.trim() || 'Android';
    label = constants.Release
      ? model + ' (Android ' + constants.Release + ')'
      : model;
  }
  return label.replace(/[^\x20-\x7e]/g, '').slice(0, 80);
}
