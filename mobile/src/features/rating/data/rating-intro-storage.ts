import * as Keychain from 'react-native-keychain';
import type { RatingIntroStorage } from '../domain/models';

// Like the onboarding flag: the keychain is the app's only persistent store.
// It remembers the last season whose intro was shown.
const service = 'com.futcareer.rating-intro';
export const ratingIntroStorage: RatingIntroStorage = {
  async seen(seasonId) {
    try {
      const stored = await Keychain.getGenericPassword({ service });
      return !!stored && stored.password === seasonId;
    } catch {
      return false;
    }
  },
  async markSeen(seasonId) {
    try {
      await Keychain.setGenericPassword('rating', seasonId, {
        service,
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    } catch {}
  },
};
