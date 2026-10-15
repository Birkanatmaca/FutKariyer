// The intro is shown automatically once per install; afterwards it only
// opens on request (the info button on sign-up).
export interface OnboardingStorage {
  seen(): Promise<boolean>;
  markSeen(): Promise<void>;
}

export type OnboardingSlide = 'profile' | 'discover' | 'connect' | 'play';
export const onboardingSlides: readonly OnboardingSlide[] = [
  'profile',
  'discover',
  'connect',
  'play',
];
