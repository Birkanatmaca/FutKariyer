import React from 'react';
import { Linking, Text, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ApiError, request } from '../src/shared/api/client';
import { copy } from '../src/shared/lib/copy';
import {
  ankaraPostsPath,
  footballRepository,
  parseAnkaraBulletin,
  parseAnkaraPosts,
} from '../src/features/football/data/http-football-repository';
import {
  ankaraLeagueGroup,
  bulletinDayLabel,
  countMatches,
  defaultBulletinDay,
  filterBulletinDay,
  foldTurkish,
  groupAnkaraLeagues,
  isAnkaraLink,
  previousAnkaraSeason,
  seasonsNewestFirst,
} from '../src/features/football/domain/rules';
import type {
  AnkaraBulletin,
  AnkaraLeagues,
  AnkaraPosts,
} from '../src/features/football/domain/models';
import type { FootballService } from '../src/features/football/application/football-service';
import { AnkaraScreen } from '../src/features/football/ui/AnkaraScreen';
import { postDateLabel } from '../src/features/football/ui/AnkaraPostsTab';
import { dayLabel } from '../src/features/football/ui/AnkaraWeekTab';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));
jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react');
  return {
    useFocusEffect(effect: () => void | (() => void)) {
      react.useEffect(effect, [effect]);
    },
  };
});
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
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
const stamp = '2026-10-14T09:00:00Z';

const bulletin: AnkaraBulletin = {
  days: [
    {
      date: '17 Ekim 2026 Cumartesi',
      venues: [
        {
          name: 'Ankara 19 Mayıs Sahası',
          matches: [
            {
              time: '09:30',
              home: 'İSTANBUL GENÇLİK SK',
              away: 'Çankaya FK',
              league: 'U-17 Ligi',
            },
            {
              time: '11:30',
              home: 'Keçiören SK',
              away: 'Etimesgut SK',
              league: 'Süper Amatör Lig',
            },
          ],
        },
        {
          name: 'Yenimahalle Sahası',
          matches: [
            {
              time: '13:00',
              home: 'Yenimahalle SK',
              away: 'Mamak FK',
              league: 'Süper Amatör Lig',
            },
          ],
        },
      ],
    },
    {
      date: '18 Ekim 2026 Pazar',
      venues: [
        {
          name: 'Sincan Sahası',
          matches: [
            {
              time: '10:00',
              home: 'Sincan SK',
              away: 'Polatlı SK',
              league: 'U15 Kızlar Ligi',
            },
          ],
        },
      ],
    },
  ],
  leagues: ['Süper Amatör Lig', 'U-17 Ligi', 'U15 Kızlar Ligi'],
  source: 'TFF Ankara İl Temsilciliği',
  updatedAt: stamp,
};

const posts: AnkaraPosts = {
  items: [
    {
      id: 11,
      kind: 'discipline',
      title: 'Disiplin Kurulu Kararları',
      date: '2026-10-14T10:00:00',
      url: 'https://tffankara.org/disiplin-kurulu-kararlari/',
      attachments: [
        {
          name: 'kararlar.xlsx',
          url: 'https://tffankara.org/wp-content/uploads/kararlar.xlsx',
          type: 'excel',
        },
      ],
    },
    {
      id: 12,
      kind: 'news',
      title: 'Hakem semineri',
      date: '2026-10-08T15:58:30',
      url: 'https://www.tffankara.org/hakem-semineri/',
      attachments: [],
    },
  ],
  page: 1,
  hasMore: true,
  source: 'TFF Ankara',
  updatedAt: stamp,
};

const option = (id: string, name: string, selected = false) => ({
  id,
  name,
  selected,
});
const leagues: AnkaraLeagues = {
  seasons: [option('29', '2025-2026'), option('30', '2026-2027', true)],
  leagues: [option('5', 'Süper Amatör', true)],
  groups: [option('0', 'Grup yok', true)],
  standings: [],
  weeks: [],
  currentWeek: 0,
  source: 'TFF Ankara İl Temsilciliği',
  updatedAt: stamp,
};

describe('ankara validators', () => {
  beforeEach(() => mockedRequest.mockReset());

  it('accepts a valid bulletin and reads it from its endpoint', async () => {
    expect(parseAnkaraBulletin(bulletin)).toEqual(bulletin);
    mockedRequest.mockResolvedValueOnce(bulletin);
    await expect(footballRepository.ankaraBulletin('t')).resolves.toEqual(
      bulletin,
    );
    expect(mockedRequest).toHaveBeenCalledWith('/v1/football/ankara/bulletin', {
      token: 't',
    });
  });

  it.each([
    ['missing leagues', { ...bulletin, leagues: undefined }],
    ['blank day', { ...bulletin, days: [{ date: ' ', venues: [] }] }],
    [
      'match without league',
      {
        ...bulletin,
        days: [
          {
            date: '17 Ekim 2026 Cumartesi',
            venues: [
              {
                name: 'Saha',
                matches: [{ time: '09:30', home: 'A', away: 'B' }],
              },
            ],
          },
        ],
      },
    ],
    ['bad update time', { ...bulletin, updatedAt: 'dün' }],
  ])('rejects a malformed bulletin (%s)', (_name, payload) => {
    expect(() => parseAnkaraBulletin(payload)).toThrow(ApiError);
    expect(() => parseAnkaraBulletin(payload)).toThrow(copy.form.unexpected);
  });

  it('accepts valid posts and reads the requested page', async () => {
    expect(parseAnkaraPosts(posts)).toEqual(posts);
    mockedRequest.mockResolvedValueOnce(posts);
    await footballRepository.ankaraPosts('t', 3);
    expect(mockedRequest).toHaveBeenCalledWith(
      '/v1/football/ankara/posts?page=3',
      { token: 't' },
    );
    expect(ankaraPostsPath(0)).toBe('/v1/football/ankara/posts?page=1');
    expect(ankaraPostsPath(99)).toBe('/v1/football/ankara/posts?page=50');
    expect(ankaraPostsPath(Number.NaN)).toBe(
      '/v1/football/ankara/posts?page=1',
    );
  });

  it.each([
    ['unknown kind', { kind: 'spam' }],
    ['zoned or broken date', { date: 'yesterday' }],
    ['non-numeric id', { id: '11' }],
    [
      'unknown attachment type',
      { attachments: [{ name: 'a', url: posts.items[0].url, type: 'zip' }] },
    ],
  ])('rejects a malformed post (%s)', (_name, patch) => {
    const payload = { ...posts, items: [{ ...posts.items[0], ...patch }] };
    expect(() => parseAnkaraPosts(payload)).toThrow(copy.form.unexpected);
  });

  it('rejects a posts page without hasMore', () => {
    expect(() => parseAnkaraPosts({ ...posts, hasMore: 'yes' })).toThrow(
      ApiError,
    );
  });

  it('drops posts and attachments that leave tffankara.org', () => {
    const parsed = parseAnkaraPosts({
      ...posts,
      items: [
        {
          ...posts.items[0],
          attachments: [
            ...posts.items[0].attachments,
            { name: 'a.pdf', url: 'http://tffankara.org/a.pdf', type: 'pdf' },
            {
              name: 'b.pdf',
              url: 'https://tffankara.org.evil.example/b.pdf',
              type: 'pdf',
            },
            {
              name: 'c.pdf',
              url: 'https://tffankara.org@evil.example/c.pdf',
              type: 'pdf',
            },
          ],
        },
        { ...posts.items[1], url: 'https://spam.example/casino' },
      ],
    });
    expect(parsed.items.map(item => item.id)).toEqual([11]);
    expect(parsed.items[0].attachments).toEqual(posts.items[0].attachments);
  });

  it('allows only https links on tffankara.org', () => {
    expect(isAnkaraLink('https://tffankara.org')).toBe(true);
    expect(isAnkaraLink('https://www.tffankara.org/a?b=c#d')).toBe(true);
    expect(isAnkaraLink('http://tffankara.org/a')).toBe(false);
    expect(isAnkaraLink('https://sistem.tffankara.org/a')).toBe(false);
    expect(isAnkaraLink('https://tffankara.org.evil.example/')).toBe(false);
    expect(isAnkaraLink('https://tffankara.org@evil.example/')).toBe(false);
    expect(isAnkaraLink(['javascript', 'alert(1)'].join(':'))).toBe(false);
    expect(isAnkaraLink('https://tffankara.org/a b')).toBe(false);
  });
});

describe('ankara rules', () => {
  it('groups league names into families', () => {
    expect(ankaraLeagueGroup('SÜPER AMATÖR LİG')).toBe('amateur');
    expect(ankaraLeagueGroup('1. Amatör Lig')).toBe('amateur');
    expect(ankaraLeagueGroup('U-17 Ligi')).toBe('youth');
    expect(ankaraLeagueGroup('U11 LİGİ')).toBe('youth');
    expect(ankaraLeagueGroup('U15 KIZLAR LİGİ')).toBe('girls');
    expect(ankaraLeagueGroup('Süper Amatör Play-Off')).toBe('playoff');
    expect(ankaraLeagueGroup('Veteranlar Turnuvası')).toBe('other');
    expect(
      groupAnkaraLeagues([
        option('1', 'Veteranlar'),
        option('2', 'U-19 Ligi'),
        option('3', '2. Amatör'),
      ]).map(entry => [entry.group, entry.leagues.map(l => l.id)]),
    ).toEqual([
      ['amateur', ['3']],
      ['youth', ['2']],
      ['other', ['1']],
    ]);
  });

  it('orders seasons newest first and offers the previous one when few leagues', () => {
    expect(seasonsNewestFirst(leagues.seasons).map(s => s.id)).toEqual([
      '30',
      '29',
    ]);
    expect(previousAnkaraSeason(leagues)?.id).toBe('29');
    const many = Array.from({ length: 5 }, (_, i) => option(String(i), 'L'));
    expect(previousAnkaraSeason({ ...leagues, leagues: many })).toBeNull();
    expect(
      previousAnkaraSeason({
        ...leagues,
        seasons: [option('29', '2025-2026', true), option('30', '2026-2027')],
      }),
    ).toBeNull();
  });

  it('derives short day labels from the bulletin date', () => {
    expect(dayLabel('17 Ekim 2026 Cumartesi')).toBe('Cmt 17');
    expect(dayLabel('18 EKİM 2026 PAZAR')).toBe('Paz 18');
    expect(dayLabel('21 Ekim 2026 Çarşamba')).toBe('Çar 21');
    expect(dayLabel('20 Ekim 2026 Salı')).toBe('Sal 20');
    expect(bulletinDayLabel('Hafta içi', text.weekdaysShort)).toBe('Hafta içi');
  });

  it('starts on today, else the next bulletin day', () => {
    const at = (iso: string) => new Date(iso);
    expect(defaultBulletinDay(bulletin.days, at('2026-10-18T08:00:00Z'))).toBe(
      1,
    );
    // 22:30 UTC on the 16th is already the 17th in Türkiye.
    expect(defaultBulletinDay(bulletin.days, at('2026-10-16T22:30:00Z'))).toBe(
      0,
    );
    expect(defaultBulletinDay(bulletin.days, at('2026-10-14T08:00:00Z'))).toBe(
      0,
    );
    expect(defaultBulletinDay(bulletin.days, at('2026-10-20T08:00:00Z'))).toBe(
      0,
    );
  });

  it('filters teams case-insensitively with Turkish letters', () => {
    expect(foldTurkish('İSTANBUL')).toBe('istanbul');
    expect(foldTurkish('ISTANBUL')).toBe('istanbul');
    const day = bulletin.days[0];
    const byName = (query: string) =>
      filterBulletinDay(day, { league: '', query }).flatMap(venue =>
        venue.matches.map(match => match.home),
      );
    expect(byName('istanbul')).toEqual(['İSTANBUL GENÇLİK SK']);
    expect(byName('çankaya')).toEqual(['İSTANBUL GENÇLİK SK']);
    expect(byName('cankaya')).toEqual(['İSTANBUL GENÇLİK SK']);
    expect(byName('MAMAK')).toEqual(['Yenimahalle SK']);
    expect(byName('yok böyle')).toEqual([]);
    const amateur = filterBulletinDay(day, {
      league: 'Süper Amatör Lig',
      query: '',
    });
    expect(countMatches(amateur)).toBe(2);
    expect(amateur.map(venue => venue.name)).toEqual([
      'Ankara 19 Mayıs Sahası',
      'Yenimahalle Sahası',
    ]);
  });

  it('labels post dates relative to Türkiye today', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    expect(postDateLabel('2026-10-14T10:00:00', now)).toBe(text.today);
    expect(postDateLabel('2026-10-13T23:59:00', now)).toBe(text.yesterday);
    expect(postDateLabel('2026-10-11T08:00:00', now)).toBe(text.daysAgo(3));
    expect(postDateLabel('2026-10-01T08:00:00', now)).toBe('1 Eki');
    expect(postDateLabel('2025-12-30T08:00:00', now)).toBe('30 Ara 2025');
  });
});

function fakeService(overrides: Partial<FootballService> = {}) {
  return {
    ankara: jest.fn(async () => leagues),
    ankaraBulletin: jest.fn(async () => bulletin),
    ankaraPosts: jest.fn(async () => posts),
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
async function render(service: FootballService) {
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(
      <AnkaraScreen token="t" service={service} onBack={jest.fn()} />,
    );
  });
  await flush();
  return root;
}
const pressable = (root: ReactTestRenderer, role: string, label: string) =>
  root.root.findAll(
    node =>
      node.props.accessibilityRole === role &&
      typeof node.props.onPress === 'function' &&
      (node.props.accessibilityLabel === label ||
        node.findAllByType(Text).some(t => t.props.children === label)),
  )[0];
async function press(root: ReactTestRenderer, role: string, label: string) {
  await act(async () => pressable(root, role, label).props.onPress());
  await flush();
}

describe('ankara hub', () => {
  let openURL: jest.SpyInstance;
  beforeEach(() => {
    // The week tab opens on today's (or the next) bulletin day.
    jest.useFakeTimers({
      now: new Date('2026-10-14T09:00:00Z'),
      doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'],
    });
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });
  afterEach(() => {
    openURL.mockRestore();
    jest.useRealTimers();
  });

  it('renders each tab from the segmented control', async () => {
    const service = fakeService();
    const root = await render(service);
    expect(
      root.root.findAll(n => n.props.accessibilityRole === 'tab').length,
    ).toBeGreaterThanOrEqual(3);
    // Standings: the season row and the previous-season jump for few leagues.
    expect(service.ankara).toHaveBeenCalledTimes(1);
    expect(texts(root)).toContain('Süper Amatör');
    const jump = pressable(root, 'button', text.previousSeason('2025-2026'));
    expect(jump).toBeTruthy();
    expect(service.ankaraBulletin).not.toHaveBeenCalled();

    await press(root, 'tab', text.ankaraTabs.week);
    expect(service.ankaraBulletin).toHaveBeenCalledWith('t');
    expect(texts(root)).toEqual(
      expect.arrayContaining([
        'Cmt 17',
        'Paz 18',
        'Ankara 19 Mayıs Sahası',
        '09:30',
        'U-17 Ligi',
      ]),
    );

    await press(root, 'tab', text.ankaraTabs.posts);
    expect(service.ankaraPosts).toHaveBeenCalledWith('t', 1);
    expect(texts(root)).toEqual(
      expect.arrayContaining([
        'Disiplin Kurulu Kararları',
        'kararlar.xlsx',
        text.loadMore,
      ]),
    );
    act(() => root.unmount());
  });

  it('filters the week by league and team', async () => {
    const root = await render(fakeService());
    await press(root, 'tab', text.ankaraTabs.week);
    const summary = () =>
      root.root.findAll(
        n =>
          typeof n.props.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.endsWith(' saha'),
      )[0].props.accessibilityLabel;
    expect(summary()).toBe(text.weekSummary(3, 2));
    await press(root, 'button', text.leagueFilter('U-17 Ligi'));
    expect(summary()).toBe(text.weekSummary(1, 1));
    await press(root, 'button', text.all);
    const input = root.root.findByType(TextInput);
    await act(async () => input.props.onChangeText('istanbul'));
    expect(summary()).toBe(text.weekSummary(1, 1));
    expect(texts(root)).toContain('İSTANBUL GENÇLİK SK');
    expect(texts(root)).not.toContain('Yenimahalle SK');
    act(() => root.unmount());
  });

  it('shows the empty and error states with retry', async () => {
    const failing = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('Kaynak şu anda alınamıyor.'))
      .mockResolvedValueOnce({ ...bulletin, days: [], leagues: [] });
    const root = await render(fakeService({ ankaraBulletin: failing }));
    await press(root, 'tab', text.ankaraTabs.week);
    expect(texts(root)).toContain('Kaynak şu anda alınamıyor.');
    await press(root, 'button', copy.form.retry);
    expect(texts(root)).toContain(text.weekEmpty);
    act(() => root.unmount());
  });

  it('opens posts and attachments only on tffankara.org', async () => {
    const unsafe: AnkaraPosts = {
      ...posts,
      hasMore: false,
      items: [
        {
          ...posts.items[0],
          attachments: [
            ...posts.items[0].attachments,
            {
              name: 'spam.pdf',
              url: 'https://spam.example/a.pdf',
              type: 'pdf',
            },
          ],
        },
      ],
    };
    const root = await render(
      fakeService({ ankaraPosts: jest.fn(async () => unsafe) }),
    );
    await press(root, 'tab', text.ankaraTabs.posts);
    expect(texts(root)).not.toContain(text.loadMore);
    await press(root, 'link', text.openAttachment('spam.pdf'));
    expect(openURL).not.toHaveBeenCalled();
    await press(root, 'link', text.openAttachment('kararlar.xlsx'));
    expect(openURL).toHaveBeenLastCalledWith(
      'https://tffankara.org/wp-content/uploads/kararlar.xlsx',
    );
    const card = root.root.findAll(
      n =>
        n.props.accessibilityRole === 'link' &&
        n.props.accessibilityHint === text.openPostHint &&
        typeof n.props.onPress === 'function',
    )[0];
    await act(async () => card.props.onPress());
    expect(openURL).toHaveBeenLastCalledWith(posts.items[0].url);
    expect(openURL).toHaveBeenCalledTimes(2);
    act(() => root.unmount());
  });

  it('filters posts by kind and loads the next page', async () => {
    const second: AnkaraPosts = {
      ...posts,
      page: 2,
      hasMore: false,
      items: [
        {
          id: 13,
          kind: 'bulletin',
          title: 'Hakemli bülten',
          date: '2026-10-07T09:00:00',
          url: 'https://tffankara.org/bulten/',
          attachments: [],
        },
      ],
    };
    const ankaraPosts = jest
      .fn()
      .mockResolvedValueOnce(posts)
      .mockResolvedValueOnce(second);
    const root = await render(fakeService({ ankaraPosts }));
    await press(root, 'tab', text.ankaraTabs.posts);
    await press(root, 'button', text.postKinds.news);
    expect(texts(root)).toContain('Hakem semineri');
    expect(texts(root)).not.toContain('Disiplin Kurulu Kararları');
    await press(root, 'button', text.postKinds.all);
    await press(root, 'button', text.loadMore);
    expect(ankaraPosts).toHaveBeenLastCalledWith('t', 2);
    expect(texts(root)).toContain('Hakemli bülten');
    expect(texts(root)).not.toContain(text.loadMore);
    act(() => root.unmount());
  });
});

describe('ankara dropdowns', () => {
  const many: AnkaraLeagues = {
    ...leagues,
    leagues: [
      option('5', 'Süper Amatör', true),
      option('6', '1. Amatör'),
      option('7', 'U-17 Ligi'),
      option('8', 'U15 Kızlar Ligi'),
      option('9', 'Play-Off Müsabakaları'),
      option('10', 'Veteranlar'),
    ],
    groups: [option('0', 'Grup yok'), option('41', 'A Grubu', true)],
  };
  const steps = (root: ReactTestRenderer) =>
    root.root.findAll(
      node =>
        node.props.accessibilityRole === 'button' &&
        typeof node.props.onPress === 'function' &&
        node.props.accessibilityState?.expanded !== undefined,
    );
  const state = (root: ReactTestRenderer) =>
    steps(root).map(step => ({
      label: step.props.accessibilityLabel,
      disabled: step.props.accessibilityState.disabled,
    }));
  const optionNode = (root: ReactTestRenderer, name: string) =>
    root.root.findAll(
      node =>
        node.props.accessibilityRole === 'button' &&
        node.props.accessibilityLabel === name &&
        typeof node.props.onPress === 'function',
    )[0];

  it('opens one step at a time with family sections and a marked selection', async () => {
    const service = fakeService({
      ankara: jest.fn(async () => many),
    } as Partial<FootballService>);
    const root = await render(service);
    expect(state(root)).toEqual([
      {
        label: text.selectStep(1, text.seasonLabel, '2026-2027'),
        disabled: false,
      },
      {
        label: text.selectStep(2, text.leagueLabel, 'Süper Amatör'),
        disabled: false,
      },
      {
        label: text.selectStep(3, text.groupLabel, 'A Grubu'),
        disabled: false,
      },
    ]);
    // Lists stay closed until their field is tapped.
    expect(optionNode(root, '1. Amatör')).toBeUndefined();
    await act(async () => steps(root)[1].props.onPress());
    expect(steps(root)[1].props.accessibilityState.expanded).toBe(true);
    const headers = root.root
      .findAll(node => node.props.accessibilityRole === 'header')
      .map(node =>
        node
          .findAllByType(Text)
          .map(t => t.props.children)
          .join(''),
      );
    expect(headers).toEqual(
      expect.arrayContaining(['AMATÖR', 'ALTYAPI', 'KIZ', 'PLAY-OFF', 'DİĞER']),
    );
    expect(
      optionNode(root, 'Süper Amatör').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      optionNode(root, '1. Amatör').props.accessibilityState.selected,
    ).toBe(false);
    // Opening another step closes the first.
    await act(async () => steps(root)[0].props.onPress());
    expect(steps(root)[1].props.accessibilityState.expanded).toBe(false);
    expect(steps(root)[0].props.accessibilityState.expanded).toBe(true);
    // Tapping the selected value only closes the list.
    await act(async () => optionNode(root, '2026-2027').props.onPress());
    expect(service.ankara).toHaveBeenCalledTimes(1);
    expect(steps(root)[0].props.accessibilityState.expanded).toBe(false);
    act(() => root.unmount());
  });

  it('clears and locks the steps below a change until it loads', async () => {
    let resolve!: (value: AnkaraLeagues) => void;
    const ankara = jest
      .fn()
      .mockResolvedValueOnce(many)
      .mockImplementationOnce(
        () => new Promise<AnkaraLeagues>(done => (resolve = done)),
      );
    const service = fakeService({ ankara } as Partial<FootballService>);
    const root = await render(service);
    await act(async () => steps(root)[0].props.onPress());
    await act(async () => optionNode(root, '2025-2026').props.onPress());
    await flush();
    expect(ankara).toHaveBeenLastCalledWith('t', {
      season: '29',
      league: '',
      group: '',
    });
    expect(state(root)).toEqual([
      {
        label: text.selectStep(1, text.seasonLabel, '2025-2026'),
        disabled: true,
      },
      { label: text.selectStep(2, text.leagueLabel, null), disabled: true },
      { label: text.selectStep(3, text.groupLabel, null), disabled: true },
    ]);
    // The league is loading; the group waits for a league.
    expect(steps(root)[1].props.accessibilityHint).toBeUndefined();
    expect(steps(root)[2].props.accessibilityHint).toBe(text.selectLocked);
    // The previous-season shortcut is hidden while loading.
    expect(optionNode(root, text.previousSeason('2025-2026'))).toBeUndefined();
    await act(async () =>
      resolve({
        ...leagues,
        seasons: [option('29', '2025-2026', true), option('30', '2026-2027')],
        leagues: [option('15', 'Süper Amatör', true)],
      }),
    );
    await flush();
    // Only "Grup yok": the group step is hidden.
    expect(state(root)).toEqual([
      {
        label: text.selectStep(1, text.seasonLabel, '2025-2026'),
        disabled: false,
      },
      {
        label: text.selectStep(2, text.leagueLabel, 'Süper Amatör'),
        disabled: false,
      },
    ]);
    act(() => root.unmount());
  });
});
