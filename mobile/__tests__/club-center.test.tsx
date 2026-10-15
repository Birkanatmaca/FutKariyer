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
import { completenessView } from '../src/features/clubs/application/club-center';
import { ClubCenterSection } from '../src/features/clubs/ui/ClubCenterSection';
import type { ClubService } from '../src/features/clubs/application/club-service';
import type {
  ClubCenter,
  ClubCenterLeague,
} from '../src/features/clubs/domain/models';
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
jest.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  ArrowUpRight: () => null,
  Check: () => null,
  ChevronRight: () => null,
  CircleAlert: () => null,
  ClipboardList: () => null,
  FileClock: () => null,
  Newspaper: () => null,
}));

const mockedRequest = request as jest.MockedFunction<typeof request>;
const id = (n: number) => n.toString(16).padStart(32, '0');

const fixture = {
  id: id(10),
  round: 3,
  opponentName: 'Rakip FK',
  isHome: true,
  kickoffAt: '2026-10-20T15:00:00Z',
  goalsFor: 2,
  goalsAgainst: 1,
  result: 'win',
};

const league: ClubCenterLeague = {
  leagueId: id(4),
  leagueName: 'Ankara Halı Saha Ligi',
  season: '2026/2027',
  status: 'active',
  teamCount: 8,
  position: 2,
  points: 13,
  played: 5,
  wins: 4,
  draws: 1,
  losses: 0,
  goalDifference: 9,
  upcoming: [
    {
      id: id(11),
      round: 6,
      opponentName: 'Kuzey Spor',
      isHome: false,
      kickoffAt: null,
    },
  ],
  recent: [
    { ...fixture, id: id(12), result: 'win', goalsFor: 3, goalsAgainst: 0 },
    {
      ...fixture,
      id: id(13),
      round: 2,
      result: 'draw',
      goalsFor: 1,
      goalsAgainst: 1,
      isHome: false,
    },
    {
      ...fixture,
      id: id(14),
      round: 1,
      result: 'loss',
      goalsFor: 0,
      goalsAgainst: 2,
    },
  ],
};

const center: ClubCenter = {
  completenessPercent: 72,
  missingFields: ['İlçe', 'Antrenman adresi'],
  pendingApplications: 3,
  pendingNews: 1,
  publishedNews: 4,
  leagues: [league],
};

beforeEach(() => {
  mockedRequest.mockReset();
});

describe('club center repository validation', () => {
  it('accepts a valid club center payload', async () => {
    mockedRequest.mockResolvedValueOnce({
      ...center,
      leagues: [
        {
          ...league,
          upcoming: [
            {
              id: id(11),
              round: 6,
              opponentName: 'Kuzey Spor',
              isHome: false,
              kickoffAt: null,
              goalsFor: null,
              goalsAgainst: null,
              result: '',
            },
          ],
        },
      ],
    });
    await expect(clubRepository.center('token')).resolves.toMatchObject({
      completenessPercent: 72,
      leagues: [{ leagueId: id(4), status: 'active' }],
    });
    expect(mockedRequest).toHaveBeenCalledWith('/v1/me/club-center', {
      token: 'token',
    });
  });

  it('rejects a malformed leagues entry', async () => {
    const badLeagues: unknown[] = [
      { ...league, leagueId: 'not-hex' },
      { ...league, status: 'paused' },
      { ...league, position: -1 },
      { ...league, goalDifference: 1.5 },
      { ...league, recent: [{ ...fixture, result: 'won' }] },
      { ...league, recent: [{ ...fixture, goalsFor: null }] },
      { ...league, upcoming: [{ ...fixture, goalsFor: 2 }] },
    ];
    for (const entry of badLeagues) {
      mockedRequest.mockResolvedValueOnce({ ...center, leagues: [entry] });
      await expect(clubRepository.center('token')).rejects.toBeInstanceOf(
        ApiError,
      );
    }
  });

  it('rejects out-of-range completeness and missing counters', async () => {
    mockedRequest.mockResolvedValueOnce({
      ...center,
      completenessPercent: 101,
    });
    await expect(clubRepository.center('token')).rejects.toBeInstanceOf(
      ApiError,
    );
    mockedRequest.mockResolvedValueOnce({ ...center, missingFields: [3] });
    await expect(clubRepository.center('token')).rejects.toBeInstanceOf(
      ApiError,
    );
    mockedRequest.mockResolvedValueOnce({ ...center, pendingNews: undefined });
    await expect(clubRepository.center('token')).rejects.toBeInstanceOf(
      ApiError,
    );
    mockedRequest.mockResolvedValueOnce(null);
    await expect(clubRepository.center('token')).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe('completeness mapping', () => {
  it('keeps missing fields while the profile is incomplete', () => {
    expect(completenessView(center)).toEqual({
      percent: 72,
      complete: false,
      missing: ['İlçe', 'Antrenman adresi'],
    });
  });

  it('hides missing fields once the profile reaches 100 percent', () => {
    expect(
      completenessView({
        ...center,
        completenessPercent: 100,
        missingFields: [],
      }),
    ).toEqual({ percent: 100, complete: true, missing: [] });
  });
});

describe('club center block', () => {
  function service(value: ClubCenter | Error) {
    return {
      center: jest.fn(() =>
        value instanceof Error ? Promise.reject(value) : Promise.resolve(value),
      ),
    } as unknown as ClubService;
  }

  async function mount(
    value: ClubCenter | Error,
    handlers: Partial<
      Record<
        'onProfile' | 'onApplications' | 'onNews' | 'onLeagues',
        () => void
      >
    > = {},
  ) {
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <ClubCenterSection
          token="token"
          service={service(value)}
          onProfile={handlers.onProfile ?? jest.fn()}
          onApplications={handlers.onApplications ?? jest.fn()}
          onNews={handlers.onNews ?? jest.fn()}
          onLeagues={handlers.onLeagues ?? jest.fn()}
        />,
      );
    });
    return root;
  }

  // Full text of every Text node, so strings split across children still match.
  function textOf(node: ReactTestInstance): string {
    return node.children
      .map(child => (typeof child === 'string' ? child : textOf(child)))
      .join('');
  }

  function texts(root: ReactTestRenderer) {
    return root.root.findAllByType(Text).map(textOf);
  }

  function press(root: ReactTestRenderer, label: string) {
    const node = root.root.findByProps({ accessibilityLabel: label });
    act(() => node.props.onPress());
  }

  it('renders the empty leagues text when the club has no leagues', async () => {
    const root = await mount({ ...center, leagues: [] });
    expect(texts(root)).toContain(copy.clubHome.leagueEmpty);
    act(() => root.unmount());
  });

  it('renders standings, recent badges and the next fixture date fallback', async () => {
    const root = await mount(center);
    const found = texts(root);
    expect(found).toContain(copy.clubHome.leaguePosition(2, 8));
    expect(found.some(t => t.includes(copy.clubHome.leagueStatus.active))).toBe(
      true,
    );
    expect(found.some(t => t.includes('G 3-0'))).toBe(true);
    expect(found.some(t => t.includes('B 1-1'))).toBe(true);
    expect(found.some(t => t.includes('M 0-2'))).toBe(true);
    expect(found.some(t => t.includes(copy.clubHome.kickoffUnknown))).toBe(
      true,
    );
    act(() => root.unmount());
  });

  it('shows the missing field chips and the profile action when incomplete', async () => {
    const onProfile = jest.fn();
    const root = await mount(center, { onProfile });
    expect(texts(root)).toEqual(
      expect.arrayContaining(['İlçe', 'Antrenman adresi']),
    );
    press(root, copy.clubHome.completeProfile);
    expect(onProfile).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('routes each work counter to its target screen', async () => {
    const onApplications = jest.fn();
    const onNews = jest.fn();
    const root = await mount(center, { onApplications, onNews });
    press(root, copy.clubHome.workApplications + ': 3');
    press(root, copy.clubHome.workPendingNews + ': 1');
    press(root, copy.clubHome.workPublishedNews + ': 4');
    expect(onApplications).toHaveBeenCalledTimes(1);
    expect(onNews).toHaveBeenCalledTimes(2);
    act(() => root.unmount());
  });

  it('shows the error state with a retry action', async () => {
    const root = await mount(new Error(copy.form.networkError));
    expect(texts(root)).toContain(copy.form.networkError);
    expect(texts(root)).toContain(copy.form.retry);
    act(() => root.unmount());
  });
});
