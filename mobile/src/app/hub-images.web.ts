import type { ImageSourcePropType } from 'react-native';
import social from '../../assets/hub/social@3x.png';
import profile from '../../assets/hub/profile@3x.png';

// Vite serves the largest render as a URL; the browser scales it down.
export const hubImages: Record<'social' | 'profile', ImageSourcePropType> = {
  social: { uri: social as string },
  profile: { uri: profile as string },
};
