module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Reanimated 4 / keyboard-controller worklets; must stay the last plugin.
  plugins: ['react-native-worklets/plugin'],
};
