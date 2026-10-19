import type { TextStyle } from 'react-native';

// Color names map to PROJECT.md. Components consume this object.
// "Gece stadyumu": a deep night pitch, layered surfaces and a single
// floodlight spill per screen; lime marks what matters.
export const colors = {
  bg: '#070A0F',
  surface: '#0F151D',
  raised: '#162029',
  overlay: '#1D2935',
  border: '#233040',
  text: '#F4F7FA',
  secondary: '#A7B3BF',
  muted: '#7F8C99',
  brand: '#B6F36A',
  brandHover: '#A2E34B',
  brandInk: '#0B1206',
  accent: '#55D7C4',
  success: '#53D68A',
  warning: '#F5BB52',
  danger: '#FF6B72',
  info: '#74AFFF',
  brandWash: '#B6F36A14',
  brandSoft: '#B6F36A29',
  accentWash: '#55D7C41F',
  infoWash: '#74AFFF1F',
  dangerWash: '#FF6B7215',
  pitchLine: '#B6F36A24',
  // Floodlight spill and hairlines used for depth instead of heavy borders.
  floodlight: '#E9FFD2',
  glow: '#B6F36A55',
  hairline: '#FFFFFF12',
  scrim: '#05070ACC',
  transparent: 'transparent',
} as const;
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};
export const radius = { sm: 12, md: 16, lg: 24, xl: 32, pill: 999 };

// Type scale. Scores, points and counters use tabular figures so columns line up.
export const type = {
  display: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  body: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  eyebrow: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  number: { fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

// Elevation: soft night shadow for layers, lime glow only for the primary action.
// Third-party marks on share targets keep their own brand colours
// (PROJECT.md, Paylaşım hedefleri); nothing else uses them.
export const partner = {
  whatsapp: '#25D366',
  instagram: ['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5'],
} as const;

export const shadow = {
  layer: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 8,
  },
  glow: {
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
} as const;
