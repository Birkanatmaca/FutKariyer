import type { OnboardingStorage } from '../domain/models';

// Browser preview keeps nothing on disk (like the session): the intro shows
// again after a page refresh and can be skipped with one tap.
let seen = false;
export const onboardingStorage: OnboardingStorage = {
  async seen() {
    return seen;
  },
  async markSeen() {
    seen = true;
  },
};
