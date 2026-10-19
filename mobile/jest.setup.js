// Native keyboard handling has no test renderer implementation; the library
// ships a mock with the same components.
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
// Profile sharing talks to native modules the test renderer does not have.
jest.mock('react-native-share', () => ({
  __esModule: true,
  default: {
    open: jest.fn(() => Promise.resolve({ success: true })),
    shareSingle: jest.fn(() => Promise.resolve({ success: true })),
    isPackageInstalled: jest.fn(() => Promise.resolve({ isInstalled: true })),
  },
  Social: {
    Instagram: 'instagram',
    InstagramStories: 'instagramstories',
    Whatsapp: 'whatsapp',
  },
}));
jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(() => Promise.resolve('/tmp/profile-card.png')),
}));
