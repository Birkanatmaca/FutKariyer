import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ApiError, request } from '../src/shared/api/client';
import { copy } from '../src/shared/lib/copy';
import {
  ankaraPath,
  footballRepository,
} from '../src/features/football/data/http-football-repository';
import {
  competitionCardWidth,
  formResults,
  groupResultsByDay,
  groupStandings,
  ankaraSelection,
  hasAnkaraGroups,
  isCup,
  nextAnkaraQuery,
  standingNote,
} from '../src/features/football/domain/rules';
import type {
  AnkaraLeagues,
  Competition,
  CompetitionCatalog,
  CompetitionStats,
  Fixture,
  LiveScores,
  Results,
  StandingRow,
  Standings,
} from '../src/features/football/domain/models';
import type { FootballService } from '../src/features/football/application/football-service';
import { AnkaraScreen } from '../src/features/football/ui/AnkaraScreen';
import { CompetitionScreen } from '../src/features/football/ui/CompetitionScreen';
import { clock } from '../src/features/football/ui/FootballStates';
import { FootballLeaguesSection } from '../src/features/football/ui/FootballLeaguesSection';
import {
  StandingsTable,
  standingNoteLabel,
} from '../src/features/football/ui/StandingsTable';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));
// Focus effects run while the fake screen is focused and clean up on blur.
jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react');
  const listeners = new Set<() => void>();
  let focused = true;
  return {
    __setFocused(value: boolean) {
      focused = value;
      listeners.forEach(listener => listener());
    },
    useFocusEffect(effect: () => void | (() => void)) {
      react.useEffect(() => {
        let cleanup: (() => void) | null = null;
        const sync = () => {
          if (focused && !cleanup) cleanup = effect() || (() => undefined);
          if (!focused && cleanup) {
            cleanup();
            cleanup = null;
          }
        };
        listeners.add(sync);
        sync();
        return () => {
          listeners.delete(sync);
          cleanup?.();
        };
      }, [effect]);
    },
  };
});
const navigation = jest.requireMock('@react-navigation/native') as {
  __setFocused(value: boolean): void;
};
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
// Every icon renders nothing; a proxy keeps the mock in step with new icons.
jest.mock(
  'lucide-react-native',
  () =>
    new Proxy(
      {},
      { get: (_target, name) => (name === '__esModule' ? false : () => null) },
    ),
);

const text = copy.footballData;
const mockedRequest = request as jest.MockedFunction<typeof request>;
const stamp = '2026-10-13T10:00:00Z';
const team = { name: 'Galatasaray', logoUrl: 'https://media.example/1.png' };

const competition: Competition = {
  slug: 'super-lig',
  name: 'Trendyol Süper Lig',
  country: 'Türkiye',
  logoUrl: 'https://media.example/203.png',
};
const catalog: CompetitionCatalog = {
  competitions: [
    competition,
    { ...competition, slug: 'premier-league', name: 'Premier League' },
    { ...competition, slug: 'la-liga', name: 'La Liga' },
    { ...competition, slug: 'serie-a', name: 'Serie A' },
    { ...competition, slug: 'bundesliga', name: 'Bundesliga' },
    { ...competition, slug: 'ligue-1', name: 'Ligue 1' },
  ],
  cups: [
    {
      slug: 'champions-league',
      name: 'Şampiyonlar Ligi',
      country: 'UEFA',
      logoUrl: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2.png',
    },
    {
      slug: 'europa-league',
      name: 'Avrupa Ligi',
      country: 'UEFA',
      logoUrl: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2310.png',
    },
    {
      slug: 'conference-league',
      name: 'Konferans Ligi',
      country: 'UEFA',
      logoUrl: 'https://a.espncdn.com/i/leaguelogos/soccer/500/20296.png',
    },
  ],
  providerConfigured: true,
  source: 'ESPN',
  ankara: { name: 'TFF Ankara Amatör Ligleri', source: 'TFF Ankara' },
};
const row: StandingRow = {
  rank: 1,
  team,
  played: 8,
  won: 6,
  drawn: 1,
  lost: 1,
  goalsFor: 18,
  goalsAgainst: 6,
  goalDiff: 12,
  points: 19,
  form: 'WWDLW',
  group: '',
  description: 'Champions League',
};
const standings: Standings = {
  season: '2026-27',
  rows: [row],
  updatedAt: stamp,
};
const result: Fixture = {
  id: 10,
  kickoff: '2026-10-12T12:00:00Z',
  status: 'finished',
  statusLabel: 'FT',
  elapsed: 90,
  round: 'Regular Season - 8',
  home: team,
  away: { name: 'Fenerbahçe', logoUrl: '' },
  homeGoals: 1,
  awayGoals: 0,
};
// Noon UTC keeps each kickoff on the same calendar day in any test time zone.
const results: Results = {
  season: '2026-27',
  items: [
    result,
    {
      ...result,
      id: 11,
      kickoff: '2026-10-12T11:00:00Z',
      home: { name: 'Beşiktaş', logoUrl: '' },
      away: { name: 'Trabzonspor', logoUrl: '' },
      homeGoals: 2,
      awayGoals: 2,
    },
    {
      ...result,
      id: 12,
      kickoff: '2026-10-11T12:00:00Z',
      round: 'Regular Season - 7',
      home: { name: 'Samsunspor', logoUrl: '' },
      away: { name: 'Göztepe', logoUrl: '' },
      homeGoals: 0,
      awayGoals: 3,
    },
  ],
  updatedAt: stamp,
};
const live: LiveScores = {
  date: '2026-10-13',
  items: [
    {
      ...result,
      id: 20,
      kickoff: '2026-10-13T12:00:00Z',
      status: 'live',
      statusLabel: "67'",
      elapsed: 67,
      round: '',
      home: { name: 'Kasımpaşa', logoUrl: '' },
      away: { name: 'Alanyaspor', logoUrl: '' },
      homeGoals: 2,
      awayGoals: 1,
    },
    {
      ...result,
      id: 21,
      kickoff: '2026-10-13T10:00:00Z',
      round: '',
      home: { name: 'Rizespor', logoUrl: '' },
      away: { name: 'Konyaspor', logoUrl: '' },
      homeGoals: 0,
      awayGoals: 0,
    },
    {
      ...result,
      id: 22,
      kickoff: '2026-10-13T17:00:00Z',
      status: 'scheduled',
      statusLabel: 'Scheduled',
      elapsed: null,
      round: '',
      home: { name: 'Antalyaspor', logoUrl: '' },
      away: { name: 'Kayserispor', logoUrl: '' },
      homeGoals: null,
      awayGoals: null,
    },
  ],
  updatedAt: stamp,
};
const stats: CompetitionStats = {
  season: '2026-27',
  topScorers: [
    {
      rank: 1,
      name: 'Oyuncu',
      photoUrl: '',
      team,
      value: 9,
      appearances: 8,
    },
  ],
  topAssists: [],
  updatedAt: stamp,
};
const option = (id: string, name: string, selected = false) => ({
  id,
  name,
  selected,
});
const ankara: AnkaraLeagues = {
  seasons: [option('30', '2026-2027', true), option('29', '2025-2026')],
  leagues: [option('5', 'Süper Amatör', true), option('6', '1. Amatör')],
  groups: [option('0', 'Grup yok'), option('2', 'B Grubu', true)],
  standings: [{ ...row, team: { name: 'Ankara Gücü', logoUrl: '' }, form: '' }],
  weeks: [
    {
      number: 1,
      matches: [
        {
          date: '10 Ekim 2026 Cumartesi',
          time: '10:00',
          venue: 'Saha 1',
          home: 'Ankara Gücü',
          away: 'Çankaya FK',
          homeGoals: 2,
          awayGoals: 1,
          status: 'MS',
        },
      ],
    },
    {
      number: 2,
      matches: [
        {
          date: '17 Ekim 2026 Cumartesi',
          time: 'Saati belirlenmedi',
          venue: '',
          home: 'Çankaya FK',
          away: 'Ankara Gücü',
          homeGoals: null,
          awayGoals: null,
          status: '-',
        },
      ],
    },
  ],
  currentWeek: 2,
  source: 'TFF Ankara İl Temsilciliği',
  updatedAt: stamp,
};

function fakeService(overrides: Partial<FootballService> = {}) {
  return {
    competitions: jest.fn(async () => catalog),
    standings: jest.fn(async () => standings),
    live: jest.fn(async () => live),
    results: jest.fn(async () => results),
    stats: jest.fn(async () => stats),
    ankara: jest.fn(async () => ankara),
    ankaraBulletin: jest.fn(async () => ({
      days: [],
      leagues: [],
      source: 'TFF Ankara',
      updatedAt: stamp,
    })),
    ankaraPosts: jest.fn(async () => ({
      items: [],
      page: 1,
      hasMore: false,
      source: 'TFF Ankara',
      updatedAt: stamp,
    })),
    ...overrides,
  } as unknown as FootballService & Record<string, jest.Mock>;
}

const texts = (root: ReactTestRenderer) =>
  root.root
    .findAllByType(Text)
    .map(node => [node.props.children].flat().join(''));
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('football repository validators', () => {
  beforeEach(() => mockedRequest.mockReset());
  const cases: [
    string,
    () => Promise<unknown>,
    unknown,
    Record<string, unknown>,
  ][] = [
    [
      'competitions',
      () => footballRepository.competitions('t'),
      catalog,
      { competitions: [{ ...competition, slug: 'eredivisie' }] },
    ],
    [
      'cups',
      () => footballRepository.competitions('t'),
      catalog,
      { cups: [{ ...competition, slug: 'premier-league' }] },
    ],
    [
      'cup among the leagues',
      () => footballRepository.competitions('t'),
      catalog,
      { competitions: [{ ...competition, slug: 'champions-league' }] },
    ],
    [
      'catalog source',
      () => footballRepository.competitions('t'),
      catalog,
      { source: null },
    ],
    [
      'standings',
      () => footballRepository.standings('t', 'super-lig'),
      standings,
      { rows: [{ ...row, points: '19' }] },
    ],
    [
      'standings season',
      () => footballRepository.standings('t', 'super-lig'),
      standings,
      { season: 2026 },
    ],
    [
      'live',
      () => footballRepository.live('t', 'super-lig'),
      live,
      { date: '13.10.2026' },
    ],
    [
      'live fixture',
      () => footballRepository.live('t', 'super-lig'),
      live,
      { items: [{ ...live.items[0], status: 'halftime' }] },
    ],
    [
      'live goals',
      () => footballRepository.live('t', 'super-lig'),
      live,
      { items: [{ ...live.items[2], homeGoals: '0' }] },
    ],
    [
      'results',
      () => footballRepository.results('t', 'super-lig'),
      results,
      { items: [{ ...result, home: null }] },
    ],
    [
      'results season',
      () => footballRepository.results('t', 'super-lig'),
      results,
      { season: '' },
    ],
    [
      'stats',
      () => footballRepository.stats('t', 'super-lig'),
      stats,
      { topAssists: [{ ...stats.topScorers[0], team: null }] },
    ],
    [
      'stats season',
      () => footballRepository.stats('t', 'super-lig'),
      stats,
      { season: 2026 },
    ],
    [
      'ankara',
      () =>
        footballRepository.ankara('t', { season: '', league: '', group: '' }),
      ankara,
      { groups: [{ id: 0, name: 'Grup yok', selected: true }] },
    ],
  ];
  it.each(cases)('accepts a valid %s payload', async (_, call, valid) => {
    mockedRequest.mockResolvedValueOnce(structuredClone(valid));
    await expect(call()).resolves.toEqual(valid);
  });
  it.each(cases)(
    'rejects a malformed %s payload',
    async (_, call, valid, broken) => {
      mockedRequest.mockResolvedValueOnce({
        ...(valid as object),
        ...broken,
      });
      await expect(call()).rejects.toEqual(new ApiError(copy.form.unexpected));
      mockedRequest.mockResolvedValueOnce(null);
      await expect(call()).rejects.toBeInstanceOf(ApiError);
    },
  );
  it('reads results and live scores from their endpoints', async () => {
    mockedRequest.mockResolvedValueOnce(structuredClone(results));
    await footballRepository.results('t', 'super-lig');
    expect(mockedRequest).toHaveBeenCalledWith(
      '/v1/football/competitions/super-lig/results',
      { token: 't' },
    );
    mockedRequest.mockResolvedValueOnce(structuredClone(live));
    await expect(footballRepository.live('t', 'la-liga')).resolves.toEqual(
      live,
    );
    expect(mockedRequest).toHaveBeenLastCalledWith(
      '/v1/football/competitions/la-liga/live',
      { token: 't' },
    );
  });
  it('rejects bad result scores and a missing provider flag', async () => {
    mockedRequest.mockResolvedValueOnce({
      ...results,
      items: [{ ...result, homeGoals: -1 }],
    });
    await expect(
      footballRepository.results('t', 'super-lig'),
    ).rejects.toBeInstanceOf(ApiError);
    const missing: Partial<CompetitionCatalog> = { ...catalog };
    delete missing.providerConfigured;
    mockedRequest.mockResolvedValueOnce(missing);
    await expect(footballRepository.competitions('t')).rejects.toBeInstanceOf(
      ApiError,
    );
  });
  it('accepts an older catalog without cups', async () => {
    const older: Partial<CompetitionCatalog> = structuredClone(catalog);
    delete older.cups;
    mockedRequest.mockResolvedValueOnce(older);
    await expect(footballRepository.competitions('t')).resolves.toEqual({
      ...catalog,
      cups: [],
    });
  });
  it('reads cup data from the same competition endpoints', async () => {
    mockedRequest.mockResolvedValueOnce(structuredClone(standings));
    await footballRepository.standings('t', 'conference-league');
    expect(mockedRequest).toHaveBeenLastCalledWith(
      '/v1/football/competitions/conference-league/standings',
      { token: 't' },
    );
    expect(isCup('champions-league')).toBe(true);
    expect(isCup('super-lig')).toBe(false);
  });
  it('builds the ankara query from numeric values only', () => {
    expect(ankaraPath({ season: '', league: '', group: '' })).toBe(
      '/v1/football/ankara',
    );
    expect(ankaraPath({ season: '30', league: '5', group: '0' })).toBe(
      '/v1/football/ankara?season=30&league=5&group=0',
    );
    expect(ankaraPath({ season: '30', league: 'x&y', group: '' })).toBe(
      '/v1/football/ankara?season=30',
    );
  });
});

describe('football rules', () => {
  it('fits three competition cards per row', () => {
    for (const width of [320, 360, 375, 390, 414, 430]) {
      const card = competitionCardWidth(width, 12, 24);
      const content = width - 48;
      expect(card * 3 + 12 * 2).toBeLessThanOrEqual(content);
      expect(card * 3 + 12 * 2).toBeGreaterThan(content - 3);
      expect(card).toBeGreaterThanOrEqual(80);
    }
    expect(competitionCardWidth(320, 12, 24)).toBe(82);
    expect(competitionCardWidth(1024, 12, 24)).toBe(176);
  });
  it('resets dependent ankara pickers', () => {
    expect(nextAnkaraQuery(ankara, 'season', '29')).toEqual({
      season: '29',
      league: '',
      group: '',
    });
    expect(nextAnkaraQuery(ankara, 'league', '6')).toEqual({
      season: '30',
      league: '6',
      group: '',
    });
    expect(nextAnkaraQuery(ankara, 'group', '0')).toEqual({
      season: '30',
      league: '5',
      group: '0',
    });
  });
  it('maps form letters and groups standings', () => {
    expect(formResults('wWDxL')).toEqual(['W', 'W', 'D', 'L']);
    expect(groupStandings([row, row])).toHaveLength(1);
    const grouped = groupStandings([
      { ...row, group: 'A' },
      { ...row, group: 'B' },
      { ...row, group: 'A' },
    ]);
    expect(grouped.map(group => [group.name, group.rows.length])).toEqual([
      ['A', 2],
      ['B', 1],
    ]);
  });
});

describe('standings notes', () => {
  it('maps common provider notes to Turkish labels', () => {
    expect(standingNote('Champions League')).toBe('championsLeague');
    expect(standingNote('UEFA Europa League')).toBe('europaLeague');
    expect(standingNote('Conference League Qualifiers')).toBe(
      'conferenceLeagueQualifying',
    );
    expect(standingNote('Relegation Playoff')).toBe('relegationPlayoff');
    expect(standingNote('Promotion')).toBeNull();
    expect(standingNoteLabel('Champions League')).toBe('Şampiyonlar Ligi');
    expect(standingNoteLabel('Europa League')).toBe('Avrupa Ligi');
    expect(standingNoteLabel('Conference League')).toBe('Konferans Ligi');
    expect(standingNoteLabel('Relegation')).toBe('Küme düşme');
    expect(standingNoteLabel('Promotion')).toBe('Promotion');
    expect(standingNoteLabel('Relegated')).toBe('Küme düşme');
  });
  it('maps the UEFA league phase notes', () => {
    expect(standingNote('Qualifies for round of 16')).toBe('roundOf16');
    expect(standingNote('Knockout phase playoffs - seeded')).toBe(
      'knockoutPlayoff',
    );
    expect(standingNote('Qualifies for knockout round playoffs')).toBe(
      'knockoutPlayoff',
    );
    expect(standingNote('Eliminated')).toBe('eliminated');
    expect(standingNoteLabel('Qualifies for round of 16')).toBe(
      "Son 16'ya kalır",
    );
    expect(standingNoteLabel('Knockout phase playoffs - unseeded')).toBe(
      'Play-off turu',
    );
    expect(standingNoteLabel('Eliminated')).toBe('Elendi');
    expect(standingNoteLabel('Qualifies for quarterfinals')).toBe(
      'Qualifies for quarterfinals',
    );
  });
  it('lists seeded and unseeded play-off places once in the legend', () => {
    let root!: ReactTestRenderer;
    act(() => {
      root = create(
        <StandingsTable
          rows={[
            { ...row, form: '', description: 'Qualifies for round of 16' },
            {
              ...row,
              rank: 9,
              form: '',
              description: 'Knockout phase playoffs - seeded',
            },
            {
              ...row,
              rank: 17,
              form: '',
              description: 'Knockout phase playoffs - unseeded',
            },
            { ...row, rank: 25, form: '', description: 'Eliminated' },
          ]}
        />,
      );
    });
    const shown = texts(root);
    expect(shown.filter(value => value === 'Play-off turu')).toHaveLength(1);
    expect(shown).toEqual(
      expect.arrayContaining(["Son 16'ya kalır", 'Elendi']),
    );
    act(() => root.unmount());
  });
  it('shows Turkish legend labels and hides an empty form strip', () => {
    let root!: ReactTestRenderer;
    act(() => {
      root = create(
        <StandingsTable
          rows={[
            { ...row, form: '' },
            { ...row, rank: 18, description: 'Relegation', form: '' },
            { ...row, rank: 19, description: 'Promotion', form: '' },
          ]}
        />,
      );
    });
    const shown = texts(root);
    expect(shown).toEqual(
      expect.arrayContaining(['Şampiyonlar Ligi', 'Küme düşme', 'Promotion']),
    );
    expect(shown).not.toContain('Champions League');
    expect(
      root.root.findAll(
        node =>
          typeof node.props.accessibilityLabel === 'string' &&
          node.props.accessibilityLabel.startsWith(text.formLabel),
      ),
    ).toHaveLength(0);
    act(() => root.unmount());
  });
});

describe('results grouping', () => {
  it('groups results by calendar day keeping newest first', () => {
    expect(
      groupResultsByDay(results.items).map(day => [
        day.key,
        day.items.map(item => item.id),
      ]),
    ).toEqual([
      ['2026-10-12', [10, 11]],
      ['2026-10-11', [12]],
    ]);
    expect(groupResultsByDay([])).toEqual([]);
  });
});

describe('ankara selection', () => {
  const query = { season: '', league: '', group: '' };
  it('shows the server selection and clears the steps below a change', () => {
    const names = (value: ReturnType<typeof ankaraSelection>) => [
      value.season?.name ?? null,
      value.league?.name ?? null,
      value.group?.name ?? null,
    ];
    expect(names(ankaraSelection(ankara, query, false))).toEqual([
      '2026-2027',
      'Süper Amatör',
      'B Grubu',
    ]);
    // A new season clears league and group while it loads.
    expect(
      names(ankaraSelection(ankara, { ...query, season: '29' }, true)),
    ).toEqual(['2025-2026', null, null]);
    // A new league clears only the group.
    expect(
      names(
        ankaraSelection(ankara, { season: '30', league: '6', group: '' }, true),
      ),
    ).toEqual(['2026-2027', '1. Amatör', null]);
    // Without a league the group has no value either.
    const noLeague = {
      ...ankara,
      leagues: ankara.leagues.map(item => ({ ...item, selected: false })),
    };
    expect(names(ankaraSelection(noLeague, query, false))).toEqual([
      '2026-2027',
      null,
      null,
    ]);
  });
  it('hides the group step when the league has no groups', () => {
    expect(hasAnkaraGroups(ankara.groups)).toBe(true);
    expect(hasAnkaraGroups([option('0', 'Grup yok', true)])).toBe(false);
    expect(hasAnkaraGroups([])).toBe(false);
  });
});

describe('ankara screen', () => {
  it('reloads dependent options after each picker change', async () => {
    const service = fakeService();
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <AnkaraScreen token="t" service={service} onBack={jest.fn()} />,
      );
    });
    await flush();
    expect(service.ankara).toHaveBeenLastCalledWith('t', {
      season: '',
      league: '',
      group: '',
    });
    // Current week 2 is preselected.
    expect(texts(root)).toContain('Çankaya FK');
    expect(texts(root)).toContain(text.week(2));
    // Selections are three dropdown steps: season, league, group.
    const steps = () =>
      root.root.findAll(
        node =>
          node.props.accessibilityRole === 'button' &&
          typeof node.props.onPress === 'function' &&
          node.props.accessibilityState?.expanded !== undefined,
      );
    expect(steps().map(step => step.props.accessibilityLabel)).toEqual([
      text.selectStep(1, text.seasonLabel, '2026-2027'),
      text.selectStep(2, text.leagueLabel, 'Süper Amatör'),
      text.selectStep(3, text.groupLabel, 'B Grubu'),
    ]);
    const optionNode = (name: string) =>
      root.root.findAll(
        node =>
          node.props.accessibilityRole === 'button' &&
          node.props.accessibilityLabel === name &&
          typeof node.props.onPress === 'function',
      )[0];
    const choose = async (step: number, name: string) => {
      await act(async () => steps()[step - 1].props.onPress());
      expect(steps()[step - 1].props.accessibilityState.expanded).toBe(true);
      await act(async () => optionNode(name).props.onPress());
      await flush();
    };
    await choose(2, '1. Amatör');
    expect(service.ankara).toHaveBeenLastCalledWith('t', {
      season: '30',
      league: '6',
      group: '',
    });
    await choose(3, text.noGroup);
    expect(service.ankara).toHaveBeenLastCalledWith('t', {
      season: '30',
      league: '5',
      group: '0',
    });
    await choose(1, '2025-2026');
    expect(service.ankara).toHaveBeenLastCalledWith('t', {
      season: '29',
      league: '',
      group: '',
    });
    expect(texts(root)).toContain(text.source(ankara.source));
    act(() => root.unmount());
  });
});

const renderCompetition = async (
  service: FootballService,
  initialTab?: 'standings' | 'live' | 'stats',
) => {
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(
      <CompetitionScreen
        token="t"
        service={service}
        competition={competition}
        initialTab={initialTab}
        onBack={jest.fn()}
      />,
    );
  });
  await flush();
  return root;
};
const pressTab = async (root: ReactTestRenderer, label: string) => {
  const [tab] = root.root.findAll(
    node =>
      node.props.accessibilityRole === 'tab' &&
      typeof node.props.onPress === 'function' &&
      node.findAllByType(Text).some(t => t.props.children === label),
  );
  await act(async () => tab.props.onPress());
  await flush();
};

describe('competition screen', () => {
  afterEach(() => navigation.__setFocused(true));
  it('shows the tabs, the source and the standings', async () => {
    const service = fakeService();
    const root = await renderCompetition(service);
    expect(texts(root)).toEqual(
      expect.arrayContaining([
        text.tabs.standings,
        text.tabs.live,
        text.tabs.stats,
        'Kaynak: ESPN',
        '2026-27',
        'Şampiyonlar Ligi',
      ]),
    );
    expect(service.standings).toHaveBeenCalledWith('t', 'super-lig');
    expect(service.live).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
  it('renders live, finished and scheduled rows above grouped results', async () => {
    const service = fakeService();
    const root = await renderCompetition(service, 'live');
    expect(service.live).toHaveBeenCalledWith('t', 'super-lig');
    expect(service.results).toHaveBeenCalledWith('t', 'super-lig');
    const shown = texts(root);
    expect(shown).toEqual(
      expect.arrayContaining([
        text.todayHeading,
        text.live,
        "67'",
        '2 - 1',
        clock(live.items[2].kickoff),
        text.resultsHeading,
        '12 Ekim 2026 Pazartesi',
        '11 Ekim 2026 Pazar',
        '1 - 0',
        '2 - 2',
        '0 - 3',
        'Regular Season - 7',
      ]),
    );
    expect(shown.filter(value => value === text.live)).toHaveLength(1);
    // One finished match today plus three earlier results.
    expect(shown.filter(value => value === text.finished)).toHaveLength(4);
    expect(shown.indexOf(text.todayHeading)).toBeLessThan(
      shown.indexOf(text.resultsHeading),
    );
    expect(shown.indexOf('12 Ekim 2026 Pazartesi')).toBeLessThan(
      shown.indexOf('11 Ekim 2026 Pazar'),
    );
    const scheduled = root.root.findAll(
      node =>
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith('Antalyaspor'),
    );
    expect(scheduled[0].props.accessibilityLabel).toBe(
      'Antalyaspor, -, Kayserispor, ' + clock(live.items[2].kickoff),
    );
    act(() => root.unmount());
  });
  it('polls live scores every 30 seconds only while focused on the live tab', async () => {
    jest.useFakeTimers();
    const interval = jest.spyOn(globalThis, 'setInterval');
    const clear = jest.spyOn(globalThis, 'clearInterval');
    const service = fakeService();
    let root: ReactTestRenderer | undefined;
    try {
      root = await renderCompetition(service);
      expect(interval).not.toHaveBeenCalled();
      await pressTab(root, text.tabs.live);
      expect(interval).toHaveBeenCalledTimes(1);
      expect(interval.mock.calls[0][1]).toBe(30_000);
      expect(service.live).toHaveBeenCalledTimes(1);
      act(() => jest.advanceTimersByTime(30_000));
      await flush();
      expect(service.live).toHaveBeenCalledTimes(2);
      act(() => jest.advanceTimersByTime(30_000));
      await flush();
      expect(service.live).toHaveBeenCalledTimes(3);
      // Results load once per visit.
      expect(service.results).toHaveBeenCalledTimes(1);

      const timer = interval.mock.results[0].value;
      act(() => navigation.__setFocused(false));
      expect(clear).toHaveBeenCalledWith(timer);
      act(() => jest.advanceTimersByTime(120_000));
      await flush();
      expect(service.live).toHaveBeenCalledTimes(3);

      await act(async () => navigation.__setFocused(true));
      await flush();
      expect(interval).toHaveBeenCalledTimes(2);
      expect(service.live).toHaveBeenCalledTimes(4);

      await pressTab(root, text.tabs.stats);
      expect(clear).toHaveBeenCalledWith(interval.mock.results[1].value);
      act(() => jest.advanceTimersByTime(120_000));
      await flush();
      expect(service.live).toHaveBeenCalledTimes(4);
      expect(service.stats).toHaveBeenCalledTimes(1);
    } finally {
      act(() => root?.unmount());
      interval.mockRestore();
      clear.mockRestore();
      jest.useRealTimers();
    }
  });
  it('keeps live scores on screen when a background refresh fails', async () => {
    jest.useFakeTimers();
    const liveCall = jest
      .fn()
      .mockResolvedValueOnce(live)
      .mockRejectedValueOnce(new ApiError('Bağlantı hatası'));
    const service = fakeService({ live: liveCall });
    let root: ReactTestRenderer | undefined;
    try {
      root = await renderCompetition(service, 'live');
      act(() => jest.advanceTimersByTime(30_000));
      await flush();
      expect(liveCall).toHaveBeenCalledTimes(2);
      expect(texts(root)).toContain("67'");
      expect(texts(root)).not.toContain('Bağlantı hatası');
    } finally {
      act(() => root?.unmount());
      jest.useRealTimers();
    }
  });
  it('shows the empty live and results states', async () => {
    const service = fakeService({
      live: jest.fn(async () => ({ ...live, items: [] })),
      results: jest.fn(async () => ({ ...results, items: [] })),
    });
    const root = await renderCompetition(service, 'live');
    expect(texts(root)).toEqual(
      expect.arrayContaining([
        'Bugün bu ligde maç yok.',
        'Bu sezonda henüz oynanmış maç yok.',
      ]),
    );
    act(() => root.unmount());
  });
  it('shows the cups as their own row between the leagues and TFF Ankara', async () => {
    const service = fakeService();
    const open = jest.fn();
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <FootballLeaguesSection
          token="t"
          service={service}
          onOpenCompetition={open}
          onOpenAnkara={jest.fn()}
        />,
      );
    });
    await flush();
    const shown = texts(root);
    const at = (value: string) => shown.indexOf(value);
    expect(at(text.majorTitle)).toBeGreaterThanOrEqual(0);
    expect(at(text.cupsTitle)).toBeGreaterThan(at('Ligue 1'));
    expect(at('Şampiyonlar Ligi')).toBeGreaterThan(at(text.cupsTitle));
    expect(at('Konferans Ligi')).toBeLessThan(at(catalog.ankara.name));
    const cards = root.root.findAll(
      node =>
        typeof node.props.onPress === 'function' &&
        catalog.cups.some(
          cup =>
            node.props.accessibilityLabel === text.openCompetition(cup.name),
        ),
    );
    expect(cards).toHaveLength(3);
    cards[0].props.onPress();
    expect(open).toHaveBeenCalledWith(catalog.cups[0]);
    // Without cups the section is hidden.
    (service.competitions as jest.Mock).mockResolvedValueOnce({
      ...catalog,
      cups: [],
    });
    act(() => root.unmount());
    await act(async () => {
      root = create(
        <FootballLeaguesSection
          token="t"
          service={service}
          onOpenCompetition={open}
          onOpenAnkara={jest.fn()}
        />,
      );
    });
    await flush();
    expect(texts(root)).not.toContain(text.cupsTitle);
    act(() => root.unmount());
  });
  it('labels a cup screen as a European cup', async () => {
    const service = fakeService();
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <CompetitionScreen
          token="t"
          service={service}
          competition={catalog.cups[0]}
          onBack={jest.fn()}
        />,
      );
    });
    await flush();
    expect(service.standings).toHaveBeenCalledWith('t', 'champions-league');
    expect(texts(root)).toContain(text.cupEyebrow + ' · UEFA');
    act(() => root.unmount());
  });
  it('opens every competition without a coming-soon badge', async () => {
    const service = fakeService();
    const open = jest.fn();
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <FootballLeaguesSection
          token="t"
          service={service}
          onOpenCompetition={open}
          onOpenAnkara={jest.fn()}
        />,
      );
    });
    await flush();
    expect(texts(root)).not.toContain('Yakında');
    expect(texts(root)).toContain('Premier League');
    root.root
      .findAll(
        node =>
          node.props.accessibilityLabel ===
            text.openCompetition(competition.name) &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
    expect(open).toHaveBeenCalledWith(competition);
    act(() => root.unmount());
  });
});
