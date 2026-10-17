import React from 'react';
import { Animated } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ApiError, request } from '../src/shared/api/client';
import { copy } from '../src/shared/lib/copy';
import { headToHeadRepository } from '../src/features/games/data/http-head-to-head-repository';
import type { HeadToHeadService } from '../src/features/games/application/head-to-head-service';
import type {
  HeadToHeadResult,
  HeadToHeadRound,
  HeadToHeadRun,
} from '../src/features/games/domain/head-to-head';
import { HeadToHead, revealMs } from '../src/features/games/ui/HeadToHead';
import { GamesScreen } from '../src/features/games/ui/GamesScreen';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('react-native-safe-area-context', () => ({
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

const text = copy.games.headToHead;
const runId = 'a'.repeat(32);
const round = (n: number): HeadToHeadRound => ({
  id: String(n).repeat(32),
  league: {
    name: 'Premier League',
    logoUrl: 'https://a.espncdn.com/23.png',
  },
  question: { metric: n === 1 ? 'points' : 'rank', label: 'Soru ' + n },
  left: { name: 'Arsenal ' + n, logoUrl: 'https://a.espncdn.com/a.png' },
  right: { name: 'Chelsea ' + n, logoUrl: '' },
});
const run: HeadToHeadRun = {
  id: runId,
  streak: 0,
  best: 2,
  plays: 3,
  round: round(1),
};
const correct: HeadToHeadResult = {
  roundId: round(1).id,
  pick: 'left',
  correct: true,
  values: { left: 30, right: 21 },
  streak: 1,
  best: 2,
  gameOver: false,
  nextRound: round(2),
};
const wrong: HeadToHeadResult = {
  roundId: round(2).id,
  pick: 'right',
  correct: false,
  values: { left: 2, right: 9 },
  streak: 1,
  best: 2,
  gameOver: true,
  nextRound: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Animated, 'timing').mockReturnValue({
    start: jest.fn(),
  } as unknown as Animated.CompositeAnimation);
  // The rating trophy's rays turn in a loop.
  jest.spyOn(Animated, 'loop').mockReturnValue({
    start: jest.fn(),
    stop: jest.fn(),
  } as unknown as Animated.CompositeAnimation);
});

function texts(root: ReactTestRenderer) {
  return root.root
    .findAll(n => typeof n.props.children === 'string')
    .map(n => n.props.children as string);
}
function button(root: ReactTestRenderer, label: string) {
  return root.root.findAll(
    n =>
      n.props.accessibilityRole === 'button' &&
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  )[0];
}
function press(root: ReactTestRenderer, label: string) {
  const node = button(root, label);
  if (!node) throw new Error('No button ' + label);
  return act(async () => {
    await node.props.onPress();
  });
}

test('the repository rejects leaked answers and inconsistent results', async () => {
  for (const value of [
    { ...run, round: { ...run.round, left: { ...run.round.left, value: 3 } } },
    { ...run, round: { ...run.round, values: { left: 1, right: 2 } } },
    { ...run, round: { ...run.round, question: { metric: 'x', label: 'a' } } },
    { ...run, round: { ...run.round, right: run.round.left } },
    { ...run, plays: 0 },
  ]) {
    jest.mocked(request).mockResolvedValueOnce(value);
    await expect(headToHeadRepository.start('s')).rejects.toBeInstanceOf(
      ApiError,
    );
  }
  for (const value of [
    { ...correct, nextRound: null },
    { ...correct, values: { left: 4, right: 4 } },
    { ...correct, gameOver: true },
    { ...wrong, nextRound: round(3) },
    { ...correct, roundId: round(9).id },
    { ...correct, best: 0 },
  ]) {
    jest.mocked(request).mockResolvedValueOnce(value);
    await expect(
      headToHeadRepository.answer('s', runId, round(1).id, 'left'),
    ).rejects.toBeInstanceOf(ApiError);
  }
  jest.mocked(request).mockResolvedValueOnce(structuredClone(correct));
  await expect(
    headToHeadRepository.answer('s', runId, round(1).id, 'left'),
  ).resolves.toEqual(correct);
  expect(request).toHaveBeenLastCalledWith(
    '/v1/games/head-to-head/runs/' + runId + '/answers',
    {
      token: 's',
      method: 'POST',
      body: { roundId: round(1).id, pick: 'left' },
    },
  );
  jest.mocked(request).mockResolvedValueOnce({ best: -1, plays: 0 });
  await expect(headToHeadRepository.record('s')).rejects.toBeInstanceOf(
    ApiError,
  );
});

test('games are listed under their new names', async () => {
  expect(copy.games.name).toBe('Arma İzi');
  expect(copy.games.penalty.name).toBe('Beyaz Nokta');
  expect(text.name).toBe('Kafa Kafaya');
  jest.mocked(request).mockImplementation(async (path: string) =>
    path === '/v1/games/head-to-head'
      ? { best: 4, plays: 2 }
      : path === '/v1/rating'
      ? {
          season: null,
          serverTime: '2026-10-14T10:00:00Z',
          leaderboard: [],
          me: null,
          tasks: [],
        }
      : {
          plays: {
            footballGuess: { used: 0, limit: 5 },
            penalty: { used: 0, limit: 5 },
            headToHead: { used: 2, limit: 5 },
          },
          nextResetAt: '2026-10-14T21:00:00Z',
          ratingActive: false,
          serverTime: '2026-10-14T10:00:00Z',
          stats: { played: 0, wins: 0, bestScore: 0, seasonPoints: 0 },
          run: null,
          penalty: null,
        },
  );
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(<GamesScreen token="t" />);
  });
  for (const name of ['Arma İzi', 'Beyaz Nokta', 'Kafa Kafaya'])
    expect(button(root, name)).toBeDefined();
  expect(texts(root)).toContain(text.best(4));
  expect(texts(root)).not.toContain('Futbolcuyu Bul');
  // Rules are behind the "?" button, not on the card.
  expect(texts(root)).not.toContain(text.rules[0]);
  expect(button(root, 'Kafa Kafaya').props.accessibilityHint).toContain(
    text.rules[0],
  );
  await press(root, copy.games.rulesFor('Kafa Kafaya'));
  expect(texts(root)).toContain(text.rules[0]);
  await act(async () => root.unmount());
});

function fakeService(answer: jest.Mock) {
  const service: HeadToHeadService = {
    record: jest.fn().mockResolvedValue({ best: 2, plays: 3 }),
    start: jest.fn().mockResolvedValue(run),
    answer,
  };
  return service;
}

test('a correct pick reveals values and moves on; a miss ends the run with both values', async () => {
  const answer = jest
    .fn()
    .mockResolvedValueOnce(correct)
    .mockResolvedValueOnce(wrong);
  const service = fakeService(answer);
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(<HeadToHead service={service} token="t" onBack={() => {}} />);
  });
  // Face-off: question, league and both clubs, with no values before the pick.
  expect(texts(root)).toEqual(
    expect.arrayContaining([
      'Soru 1',
      'Premier League',
      'Arsenal 1',
      'Chelsea 1',
    ]),
  );
  expect(texts(root)).not.toContain('30');
  expect(button(root, text.pick('Chelsea 1'))).toBeDefined();

  await press(root, text.pick('Arsenal 1'));
  expect(answer).toHaveBeenCalledWith('t', runId, round(1).id, 'left');
  expect(texts(root)).toEqual(
    expect.arrayContaining([text.correct, '30', '21']),
  );
  expect(
    root.root.findAll(n => n.props.accessibilityLabel === text.streak(1)),
  ).not.toHaveLength(0);

  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, revealMs + 50));
  });
  expect(texts(root)).toContain('Soru 2');
  expect(texts(root)).not.toContain(text.correct);

  await press(root, text.pick('Chelsea 2'));
  expect(answer).toHaveBeenLastCalledWith('t', runId, round(2).id, 'right');
  // Rank: lower wins, shown as positions.
  expect(texts(root)).toEqual(
    expect.arrayContaining([text.wrong, text.over, '2.', '9.']),
  );
  expect(button(root, text.again)).toBeDefined();
  await press(root, text.again);
  expect(service.start).toHaveBeenCalledTimes(2);
  expect(texts(root)).toContain('Soru 1');
  await act(async () => root.unmount());
});

test('after a lost reply only the same pick can be resent', async () => {
  const answer = jest
    .fn()
    .mockRejectedValueOnce(new Error('Bağlantı koptu'))
    .mockResolvedValueOnce(correct);
  const service = fakeService(answer);
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(<HeadToHead service={service} token="t" onBack={() => {}} />);
  });
  await press(root, text.pick('Arsenal 1'));
  expect(texts(root)).toContain('Bağlantı koptu');
  expect(button(root, text.pick('Chelsea 1')).props.disabled).toBe(true);
  await press(root, text.pick('Arsenal 1'));
  expect(answer).toHaveBeenCalledTimes(2);
  expect(texts(root)).toContain(text.correct);
  await act(async () => root.unmount());
});

test('an unavailable league source shows a retry state', async () => {
  const service = fakeService(jest.fn());
  jest
    .mocked(service.start)
    .mockRejectedValueOnce(new ApiError('Lig verileri şu anda alınamıyor.'));
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(<HeadToHead service={service} token="t" onBack={() => {}} />);
  });
  expect(texts(root)).toContain('Lig verileri şu anda alınamıyor.');
  await press(root, copy.form.retry);
  expect(texts(root)).toContain('Soru 1');
  await act(async () => root.unmount());
});
