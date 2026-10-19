import { Platform } from 'react-native';
import Share, { Social } from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import { config } from '../../../shared/lib/config';
import type { ProfileSharer } from '../application/profile-share';

const androidPackages = {
  instagramStory: 'com.instagram.android',
  whatsapp: 'com.whatsapp',
} as const;

function isDismissal(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel|dismiss/i.test(message);
}

// Native: react-native-view-shot renders the card to a PNG at its full
// 9:16 size, react-native-share opens the target app with it.
export const profileSharer: ProfileSharer = {
  targets: ['instagramStory', 'whatsapp', 'more'],
  async share(card, target, message, background) {
    if (target !== 'more' && Platform.OS === 'android') {
      const { isInstalled } = await Share.isPackageInstalled(
        androidPackages[target],
      );
      if (!isInstalled) return 'unavailable';
    }
    const file = await captureRef(card, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });
    const url = file.startsWith('file://') ? file : 'file://' + file;
    try {
      if (target === 'instagramStory') {
        if (config.facebookAppId) {
          await Share.shareSingle({
            social: Social.InstagramStories,
            appId: config.facebookAppId,
            backgroundImage: url,
            backgroundTopColor: background,
            backgroundBottomColor: background,
          });
        } else {
          await Share.shareSingle({
            social: Social.Instagram,
            url,
            type: 'image/png',
          });
        }
      } else if (target === 'whatsapp') {
        await Share.shareSingle({
          social: Social.Whatsapp,
          url,
          type: 'image/png',
          message,
        });
      } else {
        const result = await Share.open({
          url,
          type: 'image/png',
          message,
          failOnCancel: false,
        });
        if (result.dismissedAction) return 'dismissed';
      }
      return 'shared';
    } catch (error) {
      if (isDismissal(error)) return 'dismissed';
      throw error;
    }
  },
};
