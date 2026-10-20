import React from 'react';
import { Image, Text } from 'react-native';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { ApiError, request } from '../src/shared/api/client';
import { clubRepository } from '../src/features/clubs/data/http-club-repository';
import {
  countdown,
  kickoffLabel,
  monogram,
  profileCompleteness,
  standingsWindow,
} from '../src/features/clubs/application/club-center';
import { ClubCenterSection } from '../src/features/clubs/ui/ClubCenterSection';
import { ClubQuickActions } from '../src/features/clubs/ui/ClubHomeSections';
import { useClubCenter } from '../src/features/clubs/application/useClubCenter';
import type { ClubService } from '../src/features/clubs/application/club-service';
import type {
  ClubCenter,
  ClubCenterLeague,
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
jest.mock('react-native-svg', () => {
  const stub = () => null;
  const exports: Record<string, unknown> = { __esModule: true };
  return new Proxy(exports, {
    get: (target, name: string) => (name in target ? target[name] : stub),
  });
});

const mockedRequest = request as jest.MockedFunction<typeof request>;
const id = (n: number) => n.toString(16).padStart(32, '0');

// Thursday 22 Oct 2026, 12:00 in Türkiye.
const now = Date.parse('2026-10-22T09:00:00Z');

const row = (
  position: number,
  teamName: string,
  points: number,
  own = false,
): ClubStanding => ({
  position,
  teamName,
  played: 5,
  wins: 3,
  draws: 1,
  losses: 1,
  goalDifference: 10 - position * 3,
  points,
  own,
});

const league: ClubCenterLeague = {
  leagueId: 'tff:20:1166:1289',
  source: 'tff',
  leagueName: 'U14 Ligi · 1. GRUP',
  season: '2026-2027',
  status: 'active',
  teamCount: 4,
  position: 2,
  points: 12,
  played: 5,
  wins: 4,
  draws: 0,
  losses: 1,
  goalDifference: 26,
  upcoming: [
    {
      id: 'tff-7-0',
      round: 7,
      opponentName: 'YENİMAHALLE BLD.',
      opponentId: '',
      opponentAvatarVersion: 0,
      isHome: true,
      kickoffAt: '2026-10-24T10:00:00Z',
      dateOnly: false,
      venue: 'ANITTEPE AVNİ BULDUK SAHA',
    },
  ],
  recent: [
    {
      id: 'tff-4-0',
      round: 4,
      opponentName: '1910 İMALATI HARBİYE SPOR',
      opponentId: '',
      opponentAvatarVersion: 0,
      isHome: true,
      kickoffAt: '2026-10-06T07:00:00Z',
      dateOnly: false,
      venue: '',
      goalsFor: 5,
      goalsAgainst: 1,
      result: 'win',
    },
    {
      id: 'tff-5-0',
      round: 5,
      opponentName: 'MAMAK BELEDİYESİ SPOR',
      opponentId: '',
      opponentAvatarVersion: 0,
      isHome: false,
      kickoffAt: '2026-10-10T07:00:00Z',
      dateOnly: false,
      venue: 'MAMAK ŞEHİR STADI',
      goalsFor: 1,
      goalsAgainst: 2,
      result: 'loss',
    },
  ],
  standings: [
    row(1, 'MAMAK BELEDİYESİ SPOR', 15),
    row(2, 'BARIŞSPOR', 12, true),
    row(3, 'ÇUBUK SPOR 1959', 12),
    row(4, 'BALA BLD.SPOR', 3),
  ],
};

const center: ClubCenter = {
  completenessPercent: 72,
  missingFields: ['İlçe'],
  pendingApplications: 3,
  pendingNews: 1,
  publishedNews: 4,
  tffLinked: true,
  leagues: [league],
};

// The server sends empty scores for unplayed matches.
const wire = (value: ClubCenter) => ({
  ...value,
  leagues: value.leagues.map(item => ({
    ...item,
    upcoming: item.upcoming.map(match => ({
      ...match,
      goalsFor: null,
      goalsAgainst: null,
      result: '',
    })),
  })),
});

beforeEach(() => {
  mockedRequest.mockReset();
});

describe('club center repository validation', () => {
  it('accepts a TFF group and a Fut Career league', async () => {
    const own = { ...league, leagueId: id(4), source: 'futcareer' as const };
    mockedRequest.mockResolvedValueOnce(
      wire({ ...center, leagues: [league, own] }),
    );
    await expect(clubRepository.center('token')).resolves.toMatchObject({
      tffLinked: true,
      leagues: [{ source: 'tff' }, { leagueId: id(4) }],
    });
    expect(mockedRequest).toHaveBeenCalledWith('/v1/me/club-center', {
      token: 'token',
    });
  });

  it('rejects malformed leagues', async () => {
    const bad: unknown[] = [
      { ...league, leagueId: 'tff:x' },
      { ...league, source: 'futcareer' },
      { ...league, source: 'espn' },
      { ...league, standings: undefined },
      { ...league, standings: [{ ...row(1, 'A', 3), own: 'yes' }] },
      { ...league, recent: [{ ...league.recent[0], venue: undefined }] },
      { ...league, recent: [{ ...league.recent[0], result: 'won' }] },
      { ...league, recent: [{ ...league.recent[0], opponentId: 'x' }] },
      { ...league, upcoming: [{ ...league.upcoming[0], goalsFor: 2 }] },
    ];
    for (const entry of bad) {
      mockedRequest.mockResolvedValueOnce({
        ...wire(center),
        leagues: [entry],
      });
      await expect(clubRepository.center('token')).rejects.toBeInstanceOf(
        ApiError,
      );
    }
    mockedRequest.mockResolvedValueOnce({
      ...wire(center),
      tffLinked: undefined,
    });
    await expect(clubRepository.center('token')).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('saves and clears the TFF link', async () => {
    const profile = {
      userId: id(1),
      name: 'Barışspor',
      footballType: 'amateur',
      district: '',
      description: '',
      venueName: '',
      venueAddress: '',
      trainingGroundName: '',
      trainingGroundAddress: '',
      trainingSchedule: '',
      tff: {
        season: '20',
        league: '1166',
        group: '1289',
        team: 'BARIŞSPOR',
        label: '2026-2027 Sezonu · U14 Ligi · 1. GRUP',
      },
      updatedAt: '2026-10-20T10:00:00Z',
    };
    const choice = {
      season: '20',
      league: '1166',
      group: '1289',
      team: 'BARIŞSPOR',
    };
    mockedRequest.mockResolvedValueOnce(profile);
    await expect(clubRepository.setTff('token', choice)).resolves.toEqual(
      profile,
    );
    expect(mockedRequest).toHaveBeenCalledWith('/v1/me/club-profile/tff', {
      method: 'PUT',
      token: 'token',
      body: choice,
    });
    mockedRequest.mockResolvedValueOnce({ ...profile, tff: null });
    await expect(clubRepository.clearTff('token')).resolves.toMatchObject({
      tff: null,
    });
    mockedRequest.mockResolvedValueOnce({
      ...profile,
      tff: { ...profile.tff, league: 'U14' },
    });
    await expect(clubRepository.clearTff('token')).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe('club center helpers', () => {
  const labels = {
    district: 'İlçe',
    description: 'Tanıtım',
    venueName: 'Saha',
    venueAddress: 'Adres',
    trainingGroundName: 'Antrenman',
    trainingGroundAddress: 'Antrenman adresi',
    trainingSchedule: 'Program',
  };
  const empty = {
    district: '',
    description: '',
    venueName: '',
    venueAddress: '',
    trainingGroundName: '',
    trainingGroundAddress: '',
    trainingSchedule: '',
  };

  it('follows the profile form for completeness', () => {
    expect(
      profileCompleteness(
        { ...empty, district: 'Altındağ', description: '  ' },
        labels,
      ),
    ).toEqual({
      percent: 14,
      complete: false,
      missing: [
        'Tanıtım',
        'Saha',
        'Adres',
        'Antrenman',
        'Antrenman adresi',
        'Program',
      ],
    });
    const full = Object.fromEntries(
      Object.keys(empty).map(key => [key, 'x']),
    ) as typeof empty;
    expect(profileCompleteness(full, labels)).toEqual({
      percent: 100,
      complete: true,
      missing: [],
    });
  });

  it('counts down in Türkiye time', () => {
    const fixture = league.upcoming[0];
    expect(countdown(fixture, now)).toEqual({
      kind: 'clock',
      days: 2,
      hours: 1,
      minutes: 0,
    });
    expect(countdown({ ...fixture, kickoffAt: null }, now)).toEqual({
      kind: 'unknown',
    });
    expect(
      countdown({ ...fixture, kickoffAt: '2026-10-22T08:00:00Z' }, now),
    ).toEqual({ kind: 'started' });
    // Midnight 7 Nov in Türkiye is still 6 Nov in UTC.
    const dateOnly = {
      ...fixture,
      kickoffAt: '2026-11-06T21:00:00Z',
      dateOnly: true,
    };
    expect(countdown(dateOnly, now)).toEqual({ kind: 'days', days: 16 });
    expect(
      countdown({ ...dateOnly, kickoffAt: '2026-10-21T21:00:00Z' }, now),
    ).toEqual({ kind: 'today' });
    expect(kickoffLabel(dateOnly)).toBe(
      '7 Kasım Cumartesi · ' + copy.clubHome.match.timeUnknown,
    );
    expect(kickoffLabel(fixture)).toBe('24 Ekim Cumartesi · 13:00');
    expect(kickoffLabel({ kickoffAt: null, dateOnly: false })).toBe(
      copy.clubHome.match.dateUnknown,
    );
  });

  it('keeps the table around the club and names crests', () => {
    const rows = Array.from({ length: 9 }, (_, index) =>
      row(index + 1, 'T' + (index + 1), 20 - index, index === 7),
    );
    expect(standingsWindow(rows).map(r => r.position)).toEqual([5, 6, 7, 8, 9]);
    expect(
      standingsWindow(rows.map(r => ({ ...r, own: r.position === 1 }))).map(
        r => r.position,
      ),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(monogram('MAMAK BELEDİYESİ SPOR')).toBe('MB');
    expect(monogram('1910 İMALATI HARBİYE SPOR')).toBe('İH');
  });
});

// The home screen owns the center read; the section only draws it.
function Harness({
  service,
  ...props
}: { service: ClubService } & Omit<
  React.ComponentProps<typeof ClubCenterSection>,
  'state'
>) {
  const state = useClubCenter(service, 'token');
  return <ClubCenterSection state={state} {...props} />;
}

describe('club home top', () => {
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
        'onProfile' | 'onApplications' | 'onNews' | 'onLeagues' | 'onLinkTff',
        () => void
      >
    > = {},
  ) {
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <Harness
          service={service(value)}
          clubName="Barışspor"
          onProfile={handlers.onProfile}
          onApplications={handlers.onApplications}
          onNews={handlers.onNews}
          onLeagues={handlers.onLeagues ?? jest.fn()}
          onLinkTff={handlers.onLinkTff}
          now={now}
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

  it('greets the club with its league line and work counters', async () => {
    const onApplications = jest.fn();
    const onNews = jest.fn();
    const onProfile = jest.fn();
    const root = await mount(center, { onApplications, onNews, onProfile });
    const found = texts(root);
    expect(found).toEqual(
      expect.arrayContaining([
        copy.home.hello,
        'Barışspor',
        copy.clubHome.helloLeague('U14 Ligi · 1. GRUP', 2),
        copy.clubHome.workTitle.toLocaleUpperCase('tr-TR'),
        '3',
        '1',
        '4',
      ]),
    );
    expect(found).not.toContain(copy.clubHome.completenessTitle);
    press(root, copy.clubHome.workApplications + ': 3');
    press(root, copy.clubHome.workPendingNews + ': 1');
    press(root, copy.clubHome.workPublishedNews + ': 4');
    press(root, copy.clubHome.helloProfile);
    expect(onApplications).toHaveBeenCalledTimes(1);
    expect(onNews).toHaveBeenCalledTimes(2);
    expect(onProfile).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('shows the next match, the table and the last score in the carousel', async () => {
    const onLeagues = jest.fn();
    const root = await mount(center, { onLeagues });
    const found = texts(root);
    const text = copy.clubHome.match;
    expect(found).toEqual(
      expect.arrayContaining([
        text.upcomingTitle.toLocaleUpperCase('tr-TR'),
        text.week(7) + ' · ' + text.home,
        'YENİMAHALLE BLD.',
        '2',
        '01',
        '00',
        '24 Ekim Cumartesi · 13:00',
        'ANITTEPE AVNİ BULDUK SAHA',
        text.standingsTitle.toLocaleUpperCase('tr-TR'),
        'BARIŞSPOR',
        text.tffSource,
        text.lastTitle.toLocaleUpperCase('tr-TR'),
        '2 - 1',
        copy.clubHome.resultName.loss,
        'G 5-1',
        'M 1-2',
      ]),
    );
    expect(
      root.root.findByProps({
        accessibilityLabel: text.countdownLabel(2, 1, 0),
      }),
    ).toBeTruthy();
    press(root, text.standingsTitle + ': ' + text.fullTable);
    expect(onLeagues).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('shows the rival crest in a Fut Career league', async () => {
    const root = await mount({
      ...center,
      leagues: [
        {
          ...league,
          leagueId: id(4),
          source: 'futcareer',
          upcoming: [
            {
              ...league.upcoming[0],
              opponentId: id(9),
              opponentAvatarVersion: 2,
            },
          ],
        },
      ],
    });
    const uris = root.root
      .findAllByType(Image)
      .map(image => (image.props.source as { uri: string }).uri);
    expect(
      uris.some(uri => uri.endsWith('/v1/users/' + id(9) + '/avatar?v=2')),
    ).toBe(true);
    expect(texts(root)).not.toContain(copy.clubHome.match.tffSource);
    act(() => root.unmount());
  });

  it('says when the next date and the results are not out yet', async () => {
    const root = await mount({
      ...center,
      leagues: [
        {
          ...league,
          upcoming: [{ ...league.upcoming[0], kickoffAt: null, venue: '' }],
          recent: [],
        },
      ],
    });
    const found = texts(root);
    const text = copy.clubHome.match;
    expect(found).toEqual(
      expect.arrayContaining([
        text.dateUnknown,
        text.venueUnknown,
        text.noRecent,
      ]),
    );
    act(() => root.unmount());
  });

  it('invites an unlinked club to pick its TFF team', async () => {
    const onLinkTff = jest.fn();
    const root = await mount(
      { ...center, tffLinked: false, leagues: [] },
      { onLinkTff },
    );
    expect(texts(root)).toContain(copy.clubHome.match.linkTitle);
    press(root, copy.clubHome.match.linkAction);
    expect(onLinkTff).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('tells a linked club when the federation page is down', async () => {
    const root = await mount({ ...center, leagues: [] });
    expect(texts(root)).toContain(copy.clubHome.match.tffDown);
    expect(texts(root)).not.toContain(copy.clubHome.match.linkAction);
    act(() => root.unmount());
  });

  it('shows the error state with a retry action', async () => {
    const root = await mount(new Error(copy.form.networkError));
    expect(texts(root)).toContain(copy.form.networkError);
    expect(texts(root)).toContain(copy.form.retry);
    expect(texts(root)).toContain(copy.home.hello);
    act(() => root.unmount());
  });
});

describe('club quick actions', () => {
  function textOf(node: ReactTestInstance): string {
    return node.children
      .map(child => (typeof child === 'string' ? child : textOf(child)))
      .join('');
  }

  it('opens every club tool from its tile and counts waiting applications', () => {
    const handlers = {
      onApplications: jest.fn(),
      onDiscover: jest.fn(),
      onSquad: jest.fn(),
      onListings: jest.fn(),
      onTournaments: jest.fn(),
      onEntries: jest.fn(),
    };
    let root!: ReactTestRenderer;
    act(() => {
      root = create(<ClubQuickActions pendingApplications={3} {...handlers} />);
    });
    const text = copy.clubHome.quick;
    const found = root.root.findAllByType(Text).map(textOf);
    expect(found).toEqual(
      expect.arrayContaining([text.title, '3', text.applicationsHint(3)]),
    );
    for (const [label, handler] of [
      [text.applications, handlers.onApplications],
      [text.discover, handlers.onDiscover],
      [text.squad, handlers.onSquad],
      [text.listings, handlers.onListings],
      [text.tournaments, handlers.onTournaments],
      [text.entries, handlers.onEntries],
    ] as const) {
      const tile = root.root.findByProps({ accessibilityLabel: label });
      act(() => tile.props.onPress());
      expect(handler).toHaveBeenCalledTimes(1);
    }
    act(() => root.unmount());
  });

  it('leaves out the tools a switched coach was not given', () => {
    let root!: ReactTestRenderer;
    act(() => {
      root = create(
        <ClubQuickActions onDiscover={jest.fn()} onTournaments={jest.fn()} />,
      );
    });
    const text = copy.clubHome.quick;
    const labels = root.root
      .findAll(node => typeof node.props.accessibilityLabel === 'string')
      .map(node => node.props.accessibilityLabel);
    expect(labels).toContain(text.discover);
    expect(labels).toContain(text.tournaments);
    expect(labels).not.toContain(text.applications);
    expect(labels).not.toContain(text.squad);
    expect(labels).not.toContain(text.entries);
    act(() => root.unmount());
  });
});
