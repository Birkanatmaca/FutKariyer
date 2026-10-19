module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  // keyboard-controller ships its jest mock as ES modules.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-keyboard-controller)/)',
  ],
};
