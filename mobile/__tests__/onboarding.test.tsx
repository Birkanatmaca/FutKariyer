import React from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import { onboardingStorage } from '../src/features/onboarding/data/onboarding-storage';
import { onboardingSlides } from '../src/features/onboarding/domain/models';
import type { OnboardingStorage } from '../src/features/onboarding';
import { OnboardingScreen } from '../src/features/onboarding/ui/OnboardingScreen';
import { AuthNavigator } from '../src/app/AuthNavigator';
import { SignUpScreen } from '../src/features/auth/ui/SignUpScreen';
import { AdvertisementBanner } from '../src/features/content/ui/AdvertisementBanner';
import {
  advertisementAspectRatio,
  advertisementImage,
} from '../src/features/content/domain/models';
import { copy } from '../src/shared/lib/copy';

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
  ACCESSIBLE: {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'after-first-unlock',
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('react-native-svg', () => {
  const stub = () => null;
  const exports: Record<string, unknown> = { __esModule: true };
  return new Proxy(exports, {
    get: (target, name: string) => (name in target ? target[name] : stub),
  });
});
jest.mock(
  'lucide-react-native',
  () =>
    new Proxy(
      {},
      { get: (_target, name) => (name === '__esModule' ? false : () => null) },
    ),
);
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));
// The stack mock records the navigator props and renders each screen's
// children with a fake navigation object so routes can be driven directly.
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  popTo: jest.fn(),
  reset: jest.fn(),
};
let mockNavigatorProps: { initialRouteName?: string } = {};
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: (props: {
      initialRouteName?: string;
      children: React.ReactNode;
    }) => {
      mockNavigatorProps = props;
      return props.children;
    },
    Screen: ({
      name,
      children,
    }: {
      name: string;
      children: (props: unknown) => React.ReactNode;
    }) =>
      name === 'Onboarding'
        ? children({ navigation: mockNavigation, route: { params: {} } })
        : null,
  }),
}));
jest.mock('../src/shared/lib/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));
jest.mock('../src/features/auth/application/AuthProvider', () => ({
  useAuth: () => ({ signUp: jest.fn() }),
}));

beforeEach(() => jest.clearAllMocks());

const text = copy.onboarding;
function press(root: ReactTestRenderer, label: string) {
  const [button] = root.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      node.props.accessibilityRole === 'button' &&
      (node.props.accessibilityLabel === label ||
        node.findAllByType(Text).some(item => item.props.children === label)) &&
      typeof node.props.onPress === 'function',
  );
  if (!button) throw new Error('No button labelled ' + label);
  act(() => button.props.onPress());
}
function texts(root: ReactTestRenderer) {
  return root.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .filter(value => typeof value === 'string');
}

describe('onboarding storage', () => {
  it('reports unseen until the flag is stored', async () => {
    jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce(false);
    await expect(onboardingStorage.seen()).resolves.toBe(false);
    jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce({
      username: 'onboarding',
      password: 'seen-v1',
      service: 'com.futcareer.onboarding',
    } as Keychain.UserCredentials);
    await expect(onboardingStorage.seen()).resolves.toBe(true);
  });

  it('treats unreadable storage as unseen and never throws on save', async () => {
    jest
      .mocked(Keychain.getGenericPassword)
      .mockRejectedValueOnce(new Error('locked'));
    await expect(onboardingStorage.seen()).resolves.toBe(false);
    jest
      .mocked(Keychain.setGenericPassword)
      .mockRejectedValueOnce(new Error('locked'));
    await expect(onboardingStorage.markSeen()).resolves.toBeUndefined();
  });

  it('stores the flag under its own keychain service', async () => {
    jest.mocked(Keychain.setGenericPassword).mockResolvedValueOnce(false);
    await onboardingStorage.markSeen();
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'onboarding',
      'seen-v1',
      expect.objectContaining({ service: 'com.futcareer.onboarding' }),
    );
  });
});

describe('OnboardingScreen', () => {
  it('steps through every slide and ends on sign-up', () => {
    const onSignUp = jest.fn(),
      onSignIn = jest.fn();
    let root!: ReactTestRenderer;
    act(() => {
      root = create(
        <OnboardingScreen
          mode="intro"
          onSignUp={onSignUp}
          onSignIn={onSignIn}
        />,
      );
    });
    for (const slide of onboardingSlides.slice(0, -1)) {
      expect(texts(root)).toContain(text.slides[slide].title);
      expect(texts(root)).not.toContain(text.signUp);
      press(root, text.next);
    }
    const last = onboardingSlides[onboardingSlides.length - 1];
    expect(texts(root)).toContain(text.slides[last].title);
    expect(texts(root)).toContain(
      text.step(onboardingSlides.length, onboardingSlides.length),
    );
    press(root, text.signUp);
    expect(onSignUp).toHaveBeenCalledTimes(1);
    press(root, text.signIn);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('can go back a slide and be skipped to sign-in', () => {
    const onSignIn = jest.fn();
    let root!: ReactTestRenderer;
    act(() => {
      root = create(
        <OnboardingScreen
          mode="intro"
          onSignUp={jest.fn()}
          onSignIn={onSignIn}
        />,
      );
    });
    press(root, text.next);
    press(root, text.previous);
    expect(texts(root)).toContain(text.slides[onboardingSlides[0]].title);
    press(root, text.skip);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('reopened as info, it closes back to sign-up', () => {
    const onClose = jest.fn();
    let root!: ReactTestRenderer;
    act(() => {
      root = create(<OnboardingScreen mode="info" onClose={onClose} />);
    });
    expect(texts(root)).not.toContain(text.skip);
    press(root, text.close);
    for (let i = 1; i < onboardingSlides.length; i += 1) press(root, text.next);
    press(root, text.backToSignUp);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('AuthNavigator', () => {
  function storage(seen: boolean): OnboardingStorage & {
    markSeen: jest.Mock;
  } {
    return { seen: jest.fn().mockResolvedValue(seen), markSeen: jest.fn() };
  }
  async function mount(store: OnboardingStorage) {
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(<AuthNavigator storage={store} />);
    });
    return root;
  }

  it('opens the intro on first launch and marks it seen when finished', async () => {
    const store = storage(false);
    store.markSeen.mockResolvedValue(undefined);
    const root = await mount(store);
    expect(mockNavigatorProps.initialRouteName).toBe('Onboarding');
    for (let i = 1; i < onboardingSlides.length; i += 1) press(root, text.next);
    press(root, text.signUp);
    expect(store.markSeen).toHaveBeenCalledTimes(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith({
      index: 1,
      routes: [{ name: 'SignIn' }, { name: 'AccountType' }],
    });
  });

  it('starts on sign-in once the intro has been seen', async () => {
    await mount(storage(true));
    expect(mockNavigatorProps.initialRouteName).toBe('SignIn');
  });

  it('skipping also counts as seen', async () => {
    const store = storage(false);
    store.markSeen.mockResolvedValue(undefined);
    const root = await mount(store);
    press(root, text.skip);
    expect(store.markSeen).toHaveBeenCalledTimes(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'SignIn' }],
    });
  });
});

test('the sign-up info button reopens the intro', () => {
  const onInfo = jest.fn();
  let root!: ReactTestRenderer;
  act(() => {
    root = create(
      <SignUpScreen onBack={jest.fn()} onInfo={onInfo} onSignIn={jest.fn()} />,
    );
  });
  press(root, text.open);
  expect(onInfo).toHaveBeenCalledTimes(1);
});

describe('AdvertisementBanner', () => {
  const ads = [
    { id: 'a'.repeat(32), imageId: 'b'.repeat(32) },
    { id: 'c'.repeat(32), imageId: '' },
  ];
  function mount(items = ads) {
    let root!: ReactTestRenderer;
    act(() => {
      root = create(
        <AdvertisementBanner items={items} imageUrl={id => '/img/' + id} />,
      );
    });
    return root;
  }
  const byTestId = (root: ReactTestRenderer, id: string) =>
    root.root.findAll(
      (node: ReactTestInstance) =>
        typeof node.type === 'string' && node.props.testID === id,
    );

  it('is one fixed-ratio rectangle with only the ad label as text', () => {
    const root = mount();
    expect(advertisementAspectRatio).toBe(
      advertisementImage.width / advertisementImage.height,
    );
    const [frame] = byTestId(root, 'advertisement-banner');
    expect(StyleSheet.flatten(frame.props.style).aspectRatio).toBe(
      advertisementAspectRatio,
    );
    expect(texts(root)).toEqual([copy.home.adTag]);
  });

  it('shows loading until the picture arrives and a placeholder when it cannot', () => {
    const root = mount();
    // The second ad has no picture at all.
    expect(byTestId(root, 'advertisement-unavailable')).toHaveLength(1);
    expect(byTestId(root, 'advertisement-loading')).toHaveLength(1);
    const image = root.root.findByType(Image);
    act(() => image.props.onLoad());
    expect(byTestId(root, 'advertisement-loading')).toHaveLength(0);
    act(() => image.props.onError());
    expect(byTestId(root, 'advertisement-unavailable')).toHaveLength(2);
    expect(root.root.findAllByType(Image)).toHaveLength(0);
  });
});
