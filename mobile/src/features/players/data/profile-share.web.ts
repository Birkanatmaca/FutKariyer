import type { ProfileSharer } from '../application/profile-share';

// Browser preview: no app targets or card capture; the Web Share API sends
// the message where the browser supports it.
export const profileSharer: ProfileSharer = {
  targets: ['more'],
  async share(_card, _target, message) {
    if (typeof navigator === 'undefined' || !navigator.share)
      return 'unavailable';
    try {
      await navigator.share({ text: message });
      return 'shared';
    } catch {
      return 'dismissed';
    }
  },
};
