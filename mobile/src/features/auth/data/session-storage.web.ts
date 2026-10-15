import type { SavedSession, SessionStorage } from '../domain/models';

// Browser preview sessions last until the page is refreshed.
let current: SavedSession | null = null;
export const sessionStorage: SessionStorage = {
  async get() {
    return current;
  },
  async save(value) {
    current = {
      token: value.token,
      expiresAt: value.expiresAt,
      kind: value.kind,
    };
  },
  async clear() {
    current = null;
  },
};
