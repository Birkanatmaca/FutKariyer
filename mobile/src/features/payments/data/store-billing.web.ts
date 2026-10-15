import type { StoreBilling } from '../domain/store';

// The browser preview cannot reach App Store or Google Play.
export const storeBilling: StoreBilling = {
  store: null,
  prices: async () => ({}),
  purchase: async () => null,
  finish: async () => {},
  unfinished: async () => [],
};
