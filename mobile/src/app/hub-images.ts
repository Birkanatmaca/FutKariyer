import type { ImageSourcePropType } from 'react-native';
import social from '../../assets/hub/social.png';
import profile from '../../assets/hub/profile.png';

// Rendered hub artworks (scripts/hub-art.py). Metro picks the @2x/@3x file for
// the screen; the web preview has its own adapter.
export const hubImages: Record<'social' | 'profile', ImageSourcePropType> = {
  social: social as number,
  profile: profile as number,
};
