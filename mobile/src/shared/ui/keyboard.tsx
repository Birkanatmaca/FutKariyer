// One place for keyboard handling (19 Oct 2026): react-native-keyboard-controller
// moves focused inputs above the keyboard the same way on every iOS and
// Android device. The web preview uses keyboard.web.tsx.
export {
  KeyboardProvider,
  KeyboardAwareScrollView,
  KeyboardAvoidingView,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';

// Space kept between the focused input and the keyboard.
export const keyboardOffset = 24;
