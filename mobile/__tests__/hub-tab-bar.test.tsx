import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { FutTabBar } from '../src/app/FutTabBar';
import { copy } from '../src/shared/lib/copy';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('lucide-react-native', () => ({
  Bell: () => null,
  Ellipsis: () => null,
  House: () => null,
  Trophy: () => null,
  Plus: () => null,
}));
// Without motion the menu opens and closes synchronously.
jest.mock('../src/shared/lib/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

const memberRoutes = [
  'Home',
  'Leagues',
  'Social',
  'Profile',
  'Teams',
  'Games',
  'Notifications',
  'More',
];

function render(names: string[], focused: string) {
  const navigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
  };
  const state = {
    index: names.indexOf(focused),
    routes: names.map(name => ({ key: name + '-key', name })),
  };
  let root!: ReactTestRenderer;
  act(() => {
    root = create(
      <FutTabBar
        {...({
          state,
          navigation,
          descriptors: {},
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        } as unknown as BottomTabBarProps)}
      />,
    );
  });
  return { root, navigation };
}

const texts = (root: ReactTestRenderer) =>
  root.root.findAllByType(Text).map(node => String(node.props.children));

const hubButton = (root: ReactTestRenderer) =>
  root.root.find(
    node =>
      node.props.accessibilityRole === 'button' &&
      typeof node.props.onLayout === 'function',
  );

function openHub(root: ReactTestRenderer) {
  act(() => {
    hubButton(root).props.onLayout({
      nativeEvent: { layout: { x: 160, y: 2, width: 80, height: 84 } },
    });
  });
  act(() => {
    hubButton(root).props.onPress();
  });
}

const option = (root: ReactTestRenderer, label: string) =>
  root.root.find(
    node =>
      node.props.accessibilityLabel === label &&
      node.props.accessibilityRole === 'button' &&
      typeof node.props.onPress === 'function',
  );

test('the idle hub opens four pages', () => {
  const { root, navigation } = render(memberRoutes, 'Home');
  const shown = texts(root);
  expect(shown).toEqual(
    expect.arrayContaining([
      copy.tabs.Home,
      copy.tabs.Leagues,
      copy.tabs.Hub,
      copy.tabs.Notifications,
      copy.tabs.More,
    ]),
  );
  // Hub pages are not separate bar items.
  expect(shown).not.toContain(copy.tabs.Teams);
  openHub(root);
  for (const label of [
    copy.tabs.Social,
    copy.tabs.Profile,
    copy.tabs.Teams,
    copy.tabs.Games,
  ])
    expect(option(root, label)).toBeTruthy();
  act(() => {
    option(root, copy.tabs.Teams).props.onPress();
  });
  expect(navigation.navigate).toHaveBeenCalledWith('Teams');
  // Choosing closes the menu.
  expect(texts(root)).not.toContain(copy.tabs.Games);
});

test('an open hub page shows its name in the centre', () => {
  const { root } = render(memberRoutes, 'Games');
  expect(texts(root)).toContain(copy.tabs.Games);
  expect(texts(root)).not.toContain(copy.tabs.Hub);
});

test('organizers only get Takımlar in the hub', () => {
  const { root } = render(
    ['Home', 'Leagues', 'Teams', 'Notifications', 'More'],
    'Home',
  );
  openHub(root);
  expect(option(root, copy.tabs.Teams)).toBeTruthy();
  expect(texts(root)).not.toContain(copy.tabs.Social);
  expect(texts(root)).not.toContain(copy.tabs.Profile);
});
