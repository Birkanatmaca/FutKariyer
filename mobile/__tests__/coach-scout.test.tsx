import React from 'react';
import { Text } from 'react-native';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { ApiError, request } from '../src/shared/api/client';
import { clubRepository } from '../src/features/clubs/data/http-club-repository';
import { CoachTeamView } from '../src/features/clubs/ui/CoachTeamView';
import type { ClubService } from '../src/features/clubs/application/club-service';
import type { CoachTeams } from '../src/features/clubs/domain/models';
import { discoveryRepository } from '../src/features/discovery/data/http-discovery-repository';
import { ScoutScreen } from '../src/features/discovery/ui/ScoutScreen';
import type { DiscoveryService } from '../src/features/discovery/application/discovery-service';
import type { DiscoveryProfile } from '../src/features/discovery/domain/models';
import { copy } from '../src/shared/lib/copy';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));
jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react');
  return {
    useFocusEffect: (effect: () => void) => react.useEffect(effect, [effect]),
  };
});
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
jest.mock('react-native-svg', () => {
  const stub = () => null;
  const exports: Record<string, unknown> = { __esModule: true };
  return new Proxy(exports, {
    get: (target, name: string) => (name in target ? target[name] : stub),
  });
});
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
  launchCamera: jest.fn(),
}));
jest.mock('react-native-video', () => () => null);
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockedRequest = request as jest.MockedFunction<typeof request>;
const id = (n: number) => n.toString(16).padStart(32, '0');

function textOf(node: ReactTestInstance): string {
  return node.children
    .map(child => (typeof child === 'string' ? child : textOf(child)))
    .join('');
}
const texts = (root: ReactTestRenderer) =>
  root.root.findAllByType(Text).map(textOf);

const teams: CoachTeams = {
  invitations: 1,
  teams: [
    {
      clubId: id(1),
      clubName: 'Barışspor',
      avatarVersion: 0,
      district: 'Altındağ',
      role: 'head_coach',
      permissions: ['squad', 'applications'],
      pendingApplications: 2,
      squadCount: 14,
      tffLinked: false,
      league: null,
    },
  ],
};

beforeEach(() => mockedRequest.mockReset());

describe('Takımım', () => {
  it('validates the coach team payload', async () => {
    mockedRequest.mockResolvedValueOnce(teams);
    await expect(clubRepository.coachTeams('token')).resolves.toEqual(teams);
    expect(mockedRequest).toHaveBeenCalledWith('/v1/me/coach-team', {
      token: 'token',
    });
    for (const bad of [
      { ...teams, invitations: -1 },
      { ...teams, teams: [{ ...teams.teams[0], clubId: 'x' }] },
      { ...teams, teams: [{ ...teams.teams[0], league: { leagueId: 1 } }] },
    ]) {
      mockedRequest.mockResolvedValueOnce(bad);
      await expect(clubRepository.coachTeams('token')).rejects.toBeInstanceOf(
        ApiError,
      );
    }
  });

  it('shows the club, the work, the rights and switches into the club', async () => {
    const onSwitch = jest.fn(() => Promise.resolve());
    const onInvitations = jest.fn();
    const service = {
      coachTeams: jest.fn(() => Promise.resolve(teams)),
    } as unknown as ClubService;
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <CoachTeamView
          token="token"
          service={service}
          onSwitch={onSwitch}
          onInvitations={onInvitations}
          onLeagues={jest.fn()}
        />,
      );
    });
    const found = texts(root);
    expect(found).toEqual(
      expect.arrayContaining([
        'Barışspor',
        'Baş antrenör · Altındağ',
        '14',
        '2',
        copy.coachTeam.invitations(1),
        copy.coachTeam.noLeagueTitle,
      ]),
    );
    expect(found.some(t => t.includes('Kadro, Başvurular'))).toBe(true);
    await act(async () => {
      root.root
        .findByProps({ accessibilityLabel: copy.coachTeam.switch })
        .props.onPress();
    });
    expect(onSwitch).toHaveBeenCalledWith(id(1));
    act(() =>
      root.root
        .findByProps({
          accessibilityLabel: copy.coachTeam.invitations(1),
        })
        .props.onPress(),
    );
    expect(onInvitations).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });
});

const player = (n: number, name: string): DiscoveryProfile => ({
  id: id(n),
  fullName: name,
  role: 'player',
  verified: false,
  isPro: false,
  avatarVersion: 0,
  district: 'Çankaya',
  isFollowing: false,
  playerProfile: {
    userId: id(n),
    position: 'Stoper',
    dominantFoot: 'right',
    experienceYears: 4,
    currentClub: '',
    availability: 'seeking_team',
    discoverable: true,
    footballType: 'amateur',
    licenseStatus: 'licensed',
    updatedAt: '2026-10-20T10:00:00Z',
  } as DiscoveryProfile['playerProfile'],
});

describe('Keşif', () => {
  it('calls the watchlist endpoints', async () => {
    mockedRequest.mockResolvedValueOnce({ items: [player(5, 'Emre Kaya')] });
    await expect(discoveryRepository.watchlist('token')).resolves.toHaveLength(
      1,
    );
    expect(mockedRequest).toHaveBeenLastCalledWith('/v1/me/watchlist', {
      token: 'token',
    });
    mockedRequest.mockResolvedValueOnce(undefined);
    await discoveryRepository.watch('token', id(5), true);
    expect(mockedRequest).toHaveBeenLastCalledWith(
      '/v1/me/watchlist/' + id(5),
      { token: 'token', method: 'PUT' },
    );
    mockedRequest.mockResolvedValueOnce(undefined);
    await discoveryRepository.watch('token', id(5), false);
    expect(mockedRequest).toHaveBeenLastCalledWith(
      '/v1/me/watchlist/' + id(5),
      { token: 'token', method: 'DELETE' },
    );
    mockedRequest.mockResolvedValueOnce({ items: [{ id: 'x' }] });
    await expect(discoveryRepository.watchlist('token')).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('lists players at once, stars one into İzleme listem', async () => {
    const emre = player(5, 'Emre Kaya');
    const service = {
      list: jest.fn(() =>
        Promise.resolve({
          items: [emre],
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
        }),
      ),
      watchlist: jest.fn(() => Promise.resolve([])),
      watch: jest.fn(() => Promise.resolve()),
    } as unknown as DiscoveryService;
    const onOpen = jest.fn();
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <ScoutScreen service={service} token="token" onOpen={onOpen} />,
      );
    });
    expect(texts(root)).toEqual(
      expect.arrayContaining([
        'Emre Kaya',
        'Stoper · Sağ ayak · Çankaya',
        copy.scout.availability.seeking_team,
        copy.scout.results(1),
      ]),
    );
    await act(async () => {
      root.root
        .findByProps({ accessibilityLabel: copy.scout.watch })
        .props.onPress();
    });
    expect(service.watch).toHaveBeenCalledWith('token', id(5), true);
    expect(texts(root)).toContain(copy.scout.watchlistCount(1));
    const tab = root.root
      .findAll(n => n.props.accessibilityRole === 'tab')
      .find(n => textOf(n).includes(copy.scout.tabs.watchlist));
    act(() => tab?.props.onPress());
    expect(
      root.root.findByProps({ accessibilityLabel: copy.scout.unwatch }),
    ).toBeTruthy();
    act(() =>
      root.root
        .findByProps({
          accessibilityLabel: 'Emre Kaya, Stoper · Sağ ayak · Çankaya',
        })
        .props.onPress(),
    );
    expect(onOpen).toHaveBeenCalledWith(id(5));
    act(() => root.unmount());
  });

  it('narrows by position and asks the server for players seeking a team', async () => {
    const service = {
      list: jest.fn(() =>
        Promise.resolve({
          items: [],
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
        }),
      ),
      watchlist: jest.fn(() => Promise.resolve([])),
      watch: jest.fn(),
    } as unknown as DiscoveryService;
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <ScoutScreen service={service} token="token" onOpen={jest.fn()} />,
      );
    });
    const chip = (label: string) =>
      root.root.findAll(
        n =>
          n.props.accessibilityRole === 'button' &&
          typeof n.props.onPress === 'function' &&
          textOf(n) === label,
      )[0];
    await act(async () => chip('Kaleci').props.onPress());
    await act(async () => chip(copy.scout.seeking).props.onPress());
    expect(service.list).toHaveBeenLastCalledWith(
      'token',
      expect.objectContaining({
        kind: 'players',
        position: 'Kaleci',
        availability: 'seeking_team',
        page: 1,
      }),
    );
    expect(texts(root)).toContain(copy.scout.noResults);
    act(() => root.unmount());
  });
});
