// Native keyboard handling has no test renderer implementation; the library
// ships a mock with the same components.
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
