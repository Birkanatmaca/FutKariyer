import * as Keychain from 'react-native-keychain';
import { sessionStorage } from '../src/features/auth/data/session-storage';
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only' },
  STORAGE_TYPE: { AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth' },
}));
beforeEach(() => jest.resetAllMocks());
test('failed secure writes reject instead of accepting an unsaved session', async () => {
  jest.mocked(Keychain.setGenericPassword).mockResolvedValue(false);
  await expect(
    sessionStorage.save({
      token: 'x'.repeat(43),
      expiresAt: '2030-01-01T00:00:00Z',
    }),
  ).rejects.toThrow();
});
test('corrupt persisted credentials are discarded', async () => {
  jest.mocked(Keychain.getGenericPassword).mockResolvedValue({
    username: 'session',
    password: '{"token":4}',
    service: 'com.futcareer.session',
    storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
  } as Keychain.UserCredentials);
  await expect(sessionStorage.get()).resolves.toBeNull();
  expect(Keychain.resetGenericPassword).toHaveBeenCalled();
});
test('valid persisted credentials can restore an existing session', async () => {
  const session = { token: 'x'.repeat(43), expiresAt: '2030-01-01T00:00:00Z' };
  jest.mocked(Keychain.getGenericPassword).mockResolvedValue({
    username: 'session',
    password: JSON.stringify(session),
    service: 'com.futcareer.session',
    storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
  } as Keychain.UserCredentials);
  await expect(sessionStorage.get()).resolves.toEqual(session);
});
