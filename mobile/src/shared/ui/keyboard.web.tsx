import React, { type PropsWithChildren } from 'react';
import {
  ScrollView,
  View,
  type ScrollViewProps,
  type ViewProps,
} from 'react-native';

// The browser handles the on-screen keyboard itself; these keep the native
// components' shape for the web preview.
export function KeyboardProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}
export function KeyboardAwareScrollView({
  bottomOffset: _bottomOffset,
  ...props
}: ScrollViewProps & { bottomOffset?: number }) {
  return <ScrollView {...props} />;
}
export function KeyboardAvoidingView({
  behavior: _behavior,
  keyboardVerticalOffset: _offset,
  ...props
}: ViewProps & { behavior?: string; keyboardVerticalOffset?: number }) {
  return <View {...props} />;
}
export function KeyboardStickyView({
  offset: _offset,
  ...props
}: ViewProps & { offset?: { closed?: number; opened?: number } }) {
  return <View {...props} />;
}
export const keyboardOffset = 24;
