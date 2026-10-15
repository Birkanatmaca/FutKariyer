// Jest stand-in: Firebase native modules are not available in tests.
export const getApp = jest.fn(() => {
  throw new Error('Firebase is not configured in tests');
});
