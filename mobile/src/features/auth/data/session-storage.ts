import * as Keychain from 'react-native-keychain';
import type { SavedSession, SessionStorage } from '../domain/models';

const service = 'com.futcareer.session';
export const sessionStorage: SessionStorage = {
  async get(): Promise<SavedSession | null> {
    const credentials = await Keychain.getGenericPassword({ service });
    if (!credentials) {
      return null;
    }
    try {
      const value = JSON.parse(credentials.password);
      if (
        typeof value.token === 'string' &&
        value.token.length === 43 &&
        typeof value.expiresAt === 'string' &&
        Number.isFinite(Date.parse(value.expiresAt)) &&
        (value.kind === undefined ||
          value.kind === 'user' ||
          value.kind === 'admin')
      ) {
        return value;
      }
    } catch {}
    await this.clear();
    return null;
  },
  async save(value: SavedSession) {
    const result = await Keychain.setGenericPassword(
      'session',
      JSON.stringify(value),
      {
        service,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      },
    );
    if (!result) {
      throw new Error('Secure session storage unavailable');
    }
  },
  async clear() {
    await Keychain.resetGenericPassword({ service });
  },
};
