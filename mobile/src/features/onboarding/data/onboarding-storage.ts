import * as Keychain from 'react-native-keychain';
import type { OnboardingStorage } from '../domain/models';

// The app has no general key-value store; the device keychain already holds
// the session, so the "intro seen" flag lives next to it under its own service.
const service = 'com.futcareer.onboarding';
const seenValue = 'seen-v1';
export const onboardingStorage: OnboardingStorage = {
  async seen() {
    try {
      const stored = await Keychain.getGenericPassword({ service });
      return !!stored && stored.password === seenValue;
    } catch {
      // Showing the intro again is harmless; blocking startup is not.
      return false;
    }
  },
  async markSeen() {
    try {
      await Keychain.setGenericPassword('onboarding', seenValue, {
        service,
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    } catch {}
  },
};
