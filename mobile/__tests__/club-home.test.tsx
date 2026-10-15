import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ApiError, request } from '../src/shared/api/client';
import { clubRepository } from '../src/features/clubs/data/http-club-repository';
import {
  mapServerFields,
  validateClubArticle,
  validateClubProfile,
  clubProfileFields,
} from '../src/features/clubs/application/validation';
import {
  clubArticleLimits,
  clubProfileLimits,
  type ClubArticle,
  type ClubProfile,
} from '../src/features/clubs/domain/models';
import { normalizeNotificationKind } from '../src/features/notifications/domain/models';
import { useAuth } from '../src/features/auth';
import { AppNavigator } from '../src/app/AppNavigator';
import { copy } from '../src/shared/lib/copy';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));
jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react');
  return {
    DarkTheme: { colors: {} },
    NavigationContainer: ({ children }: { children: React.ReactNode }) =>
      children,
    getFocusedRouteNameFromRoute: () => undefined,
    useFocusEffect: (effect: () => void) => react.useEffect(effect, [effect]),
  };
});
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: () => null,
    Screen: () => null,
  }),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    // Only the Home tab is rendered so the role switch can be observed.
    Navigator: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Screen: ({
      name,
      children,
    }: {
      name: string;
      children?: (props: { navigation: unknown }) => React.ReactNode;
    }) =>
      name === 'Home' && typeof children === 'function'
        ? children({ navigation: { navigate: jest.fn() } })
        : null,
  }),
}));
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
  launchCamera: jest.fn(),
}));
jest.mock('react-native-keychain', () => ({}));
jest.mock('react-native-video', () => () => null);
jest.mock('react-native-svg', () => {
  const stub = () => null;
  const exports: Record<string, unknown> = { __esModule: true };
  return new Proxy(exports, {
    get: (target, name: string) => (name in target ? target[name] : stub),
  });
});
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('../src/features/auth', () => ({
  useAuth: jest.fn(),
  AccountScreen: () => null,
  SignInScreen: () => null,
  SignUpScreen: () => null,
}));
jest.mock(
  'lucide-react-native',
  () =>
    new Proxy(
      {},
      {
        get: (_target, name) =>
          name === 'then' || name === '__esModule' ? undefined : () => null,
      },
    ),
);

const mockedRequest = request as jest.MockedFunction<typeof request>;
const id = (n: number) => n.toString(16).padStart(32, '0');
const stamp = '2026-10-10T10:00:00Z';

const profile: ClubProfile = {
  userId: id(1),
  name: 'Örnek Spor Kulübü',
  footballType: 'halisaha',
  district: 'Çankaya',
  description: 'Tanıtım',
  venueName: 'Ana saha',
  venueAddress: 'Adres',
  trainingGroundName: '',
  trainingGroundAddress: '',
  trainingSchedule: 'Salı 20:00',
  updatedAt: stamp,
};

const article: ClubArticle = {
  id: id(2),
  title: 'Haber başlığı',
  summary: 'Özet',
  body: 'Haber metni',
  imageId: '',
  published: false,
  showOnHome: false,
  reviewStatus: 'pending',
  authorName: 'Örnek Spor Kulübü',
  createdAt: stamp,
  updatedAt: stamp,
};

beforeEach(() => {
  mockedRequest.mockReset();
});

describe('club repository payload validation', () => {
  it('accepts a valid club profile', async () => {
    mockedRequest.mockResolvedValueOnce(profile);
    await expect(clubRepository.profile('token')).resolves.toEqual(profile);
  });

  it('rejects a profile with an unknown football type or an oversized description', async () => {
    mockedRequest.mockResolvedValueOnce({
      ...profile,
      footballType: 'five_a_side',
    });
    await expect(clubRepository.profile('token')).rejects.toBeInstanceOf(
      ApiError,
    );
    mockedRequest.mockResolvedValueOnce({
      ...profile,
      description: 'a'.repeat(clubProfileLimits.description + 1),
    });
    await expect(clubRepository.profile('token')).rejects.toBeInstanceOf(
      ApiError,
    );
    mockedRequest.mockResolvedValueOnce({ userId: id(1) });
    await expect(clubRepository.profile('token')).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('accepts a club news list and rejects malformed items', async () => {
    mockedRequest.mockResolvedValueOnce({ items: [article] });
    await expect(clubRepository.news('token')).resolves.toEqual([article]);
    mockedRequest.mockResolvedValueOnce({
      items: [{ ...article, reviewStatus: 'published' }],
    });
    await expect(clubRepository.news('token')).rejects.toBeInstanceOf(ApiError);
    mockedRequest.mockResolvedValueOnce({});
    await expect(clubRepository.news('token')).rejects.toBeInstanceOf(ApiError);
  });

  it('accepts a created article and rejects a response without one', async () => {
    mockedRequest.mockResolvedValueOnce({ article });
    await expect(
      clubRepository.createNews('token', {
        title: article.title,
        summary: article.summary,
        body: article.body,
      }),
    ).resolves.toEqual(article);
    mockedRequest.mockResolvedValueOnce({ article: { id: 'bad' } });
    await expect(
      clubRepository.createNews('token', {
        title: 'Ab',
        summary: 'Ab',
        body: 'Ab',
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('club form validation', () => {
  const empty = {
    district: '',
    description: '',
    venueName: '',
    venueAddress: '',
    trainingGroundName: '',
    trainingGroundAddress: '',
    trainingSchedule: '',
  };

  it('flags values over the profile limits and accepts values at the limit', () => {
    expect(validateClubProfile(empty)).toEqual({});
    expect(
      validateClubProfile({
        ...empty,
        description: 'a'.repeat(clubProfileLimits.description),
      }),
    ).toEqual({});
    expect(
      Object.keys(
        validateClubProfile({
          ...empty,
          description: 'a'.repeat(clubProfileLimits.description + 1),
        }),
      ),
    ).toEqual(['description']);
  });

  it('checks article title, summary and body against their minimum and maximum', () => {
    expect(
      validateClubArticle({ title: 'Ab', summary: 'Ab', body: 'Ab' }),
    ).toEqual({});
    expect(
      Object.keys(
        validateClubArticle({ title: 'a', summary: 'Ab', body: 'Ab' }),
      ),
    ).toEqual(['title']);
    expect(
      Object.keys(
        validateClubArticle({
          title: 'Ab',
          summary: 'Ab',
          body: 'a'.repeat(clubArticleLimits.body.max + 1),
        }),
      ),
    ).toEqual(['body']);
  });

  it('maps 422 field errors from the server onto known form fields only', async () => {
    const serverFields = { district: 'İlçe çok uzun.', unknownField: 'x' };
    mockedRequest.mockRejectedValueOnce(
      new ApiError('Doğrulama hatası', 422, serverFields),
    );
    let caught: unknown;
    try {
      await clubRepository.updateProfile('token', {
        ...empty,
        district: 'x',
      });
    } catch (failure) {
      caught = failure;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(
      mapServerFields((caught as ApiError).fields, clubProfileFields),
    ).toEqual({ district: 'İlçe çok uzun.' });
  });
});

describe('notification kinds', () => {
  it('keeps news_review and still tolerates unknown kinds', () => {
    expect(normalizeNotificationKind('news_review')).toBe('news_review');
    expect(normalizeNotificationKind('future_kind')).toBe('other');
    expect(copy.notifications.kinds.news_review).toBe('Haber incelemesi');
  });
});

describe('role based home tab', () => {
  function mountFor(role: 'club' | 'player') {
    jest.mocked(useAuth).mockReturnValue({
      user: {
        id: id(3),
        fullName: role === 'club' ? 'Örnek Spor Kulübü' : 'Ali Yılmaz',
        email: '',
        username: 'user',
        active: true,
        verified: false,
        role,
        city: '',
        createdAt: stamp,
      },
      token: 'token',
    } as unknown as ReturnType<typeof useAuth>);
    // Requests stay pending so only the initial section structure is rendered.
    mockedRequest.mockImplementation(() => new Promise(() => {}));
    let root!: ReactTestRenderer;
    act(() => {
      root = create(<AppNavigator />);
    });
    return root;
  }

  function texts(root: ReactTestRenderer) {
    return root.root
      .findAll(node => typeof node.props.children === 'string')
      .map(node => node.props.children as string);
  }

  it('shows the club home sections to club accounts', () => {
    const root = mountFor('club');
    const found = texts(root);
    expect(found).toContain(copy.clubHome.profileTitle);
    expect(found).toContain(copy.clubHome.centerTitle);
    expect(found).toContain(copy.clubHome.playersTitle);
    expect(found).not.toContain(copy.home.stats);
    act(() => root.unmount());
  });

  it('keeps the player home for player accounts', () => {
    const root = mountFor('player');
    const found = texts(root);
    expect(found).toContain(copy.home.stats);
    expect(found).not.toContain(copy.clubHome.profileTitle);
    act(() => root.unmount());
  });
});
