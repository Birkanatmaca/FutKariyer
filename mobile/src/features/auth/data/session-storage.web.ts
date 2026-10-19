import type { SavedSession, SessionStorage } from '../domain/models';

// Browser preview sessions last until the page is refreshed.
function memorySlot(): SessionStorage {
  let current: SavedSession | null = null;
  return {
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
}

export const sessionStorage = memorySlot();
export const clubSessionStorage = memorySlot();
