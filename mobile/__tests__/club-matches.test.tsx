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
import {
  clockLabel,
  shortDay,
  startWeek,
} from '../src/features/clubs/application/club-center';
import { ClubMatchesView } from '../src/features/clubs/ui/ClubMatchesView';
import type { ClubService } from '../src/features/clubs/application/club-service';
import type {
  ClubLeagueDetail,
  ClubLeagues,
  ClubStanding,
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
const text = copy.clubMatches;

const row = (
  position: number,
  teamName: string,
  points: number,
  own = false,
): ClubStanding => ({
  position,
  teamName,
  played: 5,
  wins: 4,
  draws: 0,
  losses: 1,
  goalDifference: 9 - position,
  points,
  own,
});

const base = {
  opponentId: '',
  opponentAvatarVersion: 0,
  dateOnly: false,
  venue: '',
};

const league: ClubLeagueDetail = {
  leagueId: 'tff:20:1166:1289',
  source: 'tff',
  leagueName: 'U14 Ligi · 1. GRUP',
  season: '2026-2027',
  status: 'active',
  teamCount: 3,
  position: 2,
  points: 12,
  played: 5,
  wins: 4,
  draws: 0,
  losses: 1,
  goalDifference: 26,
  upcoming: [],
  recent: [],
  standings: [
    row(1, 'MAMAK BELEDİYESİ SPOR', 15),
    row(2, 'BARIŞSPOR', 12, true),
    row(3, 'ÇUBUK SPOR 1959', 12),
  ],
  matches: [
    {
      ...base,
      id: 'tff-5-0',
      round: 5,
      opponentName: 'MAMAK BELEDİYESİ SPOR',
      isHome: false,
      kickoffAt: '2026-10-10T07:00:00Z',
      venue: 'MAMAK ŞEHİR STADI',
      goalsFor: 1,
      goalsAgainst: 2,
      result: 'loss',
    },
    {
      ...base,
      id: 'tff-7-0',
      round: 7,
      opponentName: 'YENİMAHALLE BLD.',
      isHome: true,
      kickoffAt: '2026-10-24T07:00:00Z',
      venue: 'G.MOGAN 1 NOLU SAHA',
      goalsFor: null,
      goalsAgainst: null,
      result: '',
    },
    {
      ...base,
      id: 'tff-8-0',
      round: 8,
      opponentName: 'ÇUBUK SPOR 1959',
      isHome: false,
      kickoffAt: null,
      goalsFor: null,
      goalsAgainst: null,
      result: '',
    },
  ],
  weeks: [
    {
      number: 5,
      matches: [
        {
          id: 'tff-5-0',
          homeName: 'MAMAK BELEDİYESİ SPOR',
          awayName: 'BARIŞSPOR',
          homeGoals: 2,
          awayGoals: 1,
          kickoffAt: '2026-10-10T07:00:00Z',
          dateOnly: false,
          venue: 'MAMAK ŞEHİR STADI',
          own: true,
        },
      ],
    },
    {
      number: 7,
      matches: [
        {
          id: 'tff-7-1',
          homeName: 'ÇUBUK SPOR 1959',
          awayName: 'BALA BLD.SPOR',
          homeGoals: null,
          awayGoals: null,
          kickoffAt: '2026-10-24T09:00:00Z',
          dateOnly: false,
          venue: '',
          own: false,
        },
      ],
    },
  ],
  currentWeek: 7,
};

const data: ClubLeagues = { tffLinked: true, leagues: [league] };

beforeEach(() => mockedRequest.mockReset());

describe('club leagues repository', () => {
  it('accepts the Maçlarım payload and rejects broken weeks or matches', async () => {
    mockedRequest.mockResolvedValueOnce(data);
    await expect(clubRepository.leagues('token')).resolves.toEqual(data);
    expect(mockedRequest).toHaveBeenCalledWith('/v1/me/club-leagues', {
      token: 'token',
    });
    const bad: unknown[] = [
      { ...league, currentWeek: -1 },
      { ...league, weeks: [{ number: 5, matches: [{ id: '' }] }] },
      {
        ...league,
        matches: [{ ...league.matches[1], goalsFor: 2, result: '' }],
      },
      { ...league, matches: undefined },
    ];
    for (const entry of bad) {
      mockedRequest.mockResolvedValueOnce({ ...data, leagues: [entry] });
      await expect(clubRepository.leagues('token')).rejects.toBeInstanceOf(
        ApiError,
      );
    }
  });
});

describe('fixture labels', () => {
  it('writes short days and times in Türkiye time', () => {
    expect(shortDay('2026-10-24T07:00:00Z')).toBe('24 Eki');
    expect(shortDay(null)).toBe('');
    expect(
      clockLabel({ kickoffAt: '2026-10-24T07:00:00Z', dateOnly: false }),
    ).toBe('10:00');
    expect(
      clockLabel({ kickoffAt: '2026-10-23T21:00:00Z', dateOnly: true }),
    ).toBe('');
    expect(startWeek([{ number: 5 }, { number: 7 }], 7)).toBe(1);
    expect(startWeek([{ number: 5 }, { number: 7 }], 9)).toBe(1);
  });
});

describe('Maçlarım', () => {
  function textOf(node: ReactTestInstance): string {
    return node.children
      .map(child => (typeof child === 'string' ? child : textOf(child)))
      .join('');
  }
  const texts = (root: ReactTestRenderer) =>
    root.root.findAllByType(Text).map(textOf);

  async function mount(value: ClubLeagues, onLinkTff?: () => void) {
    const service = {
      leagues: jest.fn(() => Promise.resolve(value)),
    } as unknown as ClubService;
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <ClubMatchesView
          token="token"
          service={service}
          clubName="Barışspor"
          onLinkTff={onLinkTff}
        />,
      );
    });
    return root;
  }

  function tab(root: ReactTestRenderer, label: string) {
    const node = root.root
      .findAll(n => n.props.accessibilityRole === 'tab')
      .find(n => textOf(n).includes(label));
    if (!node) throw new Error('tab ' + label);
    act(() => node.props.onPress());
  }

  it('shows the summary and every club match with the next one marked', async () => {
    const root = await mount(data);
    expect(texts(root)).toEqual(
      expect.arrayContaining([
        'U14 Ligi · 1. GRUP',
        '2/3',
        '12',
        '4-0-1',
        '+26',
        text.weekShort(5),
        '1-2',
        copy.clubHome.resultLabel.loss,
        text.next,
        'YENİMAHALLE BLD.',
        '24 Eki',
        '10:00',
        text.noDate,
        copy.clubHome.match.tffSource,
      ]),
    );
    act(() => root.unmount());
  });

  it('switches to the whole table and to the group weeks', async () => {
    const root = await mount(data);
    tab(root, text.sections.table);
    expect(texts(root)).toEqual(
      expect.arrayContaining(['MAMAK BELEDİYESİ SPOR', 'BARIŞSPOR', '15']),
    );
    tab(root, text.sections.weeks);
    expect(texts(root)).toEqual(
      expect.arrayContaining([text.week(7), 'ÇUBUK SPOR 1959', '12:00']),
    );
    const previous = root.root.findByProps({
      accessibilityLabel: text.previousWeek,
    });
    act(() => previous.props.onPress());
    expect(texts(root)).toEqual(
      expect.arrayContaining([text.week(5), '2 - 1']),
    );
    act(() => root.unmount());
  });

  it('invites an unlinked club to pick its TFF team', async () => {
    const onLinkTff = jest.fn();
    const root = await mount({ tffLinked: false, leagues: [] }, onLinkTff);
    const button = root.root.findByProps({
      accessibilityLabel: copy.clubHome.match.linkAction,
    });
    act(() => button.props.onPress());
    expect(onLinkTff).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });
});
