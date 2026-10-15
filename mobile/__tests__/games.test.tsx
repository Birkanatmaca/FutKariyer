import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ApiError, request } from '../src/shared/api/client';
import { gamesRepository } from '../src/features/games/data/http-games-repository';
import { useFootballGame } from '../src/features/games/application/useFootballGame';
import type { GamesService } from '../src/features/games/application/games-service';
import {
  clubInitials,
  type GameState,
} from '../src/features/games/domain/models';
import { QuizBoard } from '../src/features/games/ui/QuizBoard';
import { Image } from 'react-native';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));
jest.mock(
  'lucide-react-native',
  () =>
    new Proxy(
      {},
      { get: (_target, name) => (name === '__esModule' ? false : () => null) },
    ),
);
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual('react').useEffect(effect, [effect]),
}));

const optionId = 'a'.repeat(32);
const active: GameState = {
  hearts: 2,
  maxHearts: 3,
  nextHeartAt: '2026-10-12T13:00:00Z',
  serverTime: '2026-10-12T10:00:00Z',
  rewardEligible: true,
  stats: { played: 0, wins: 0, bestScore: 0, earnedCredits: 0 },
  penalty: null,
  run: {
    id: 'f'.repeat(32),
    status: 'active',
    answered: 0,
    score: 0,
    passed: false,
    rewardGranted: false,
    feedback: null,
    question: {
      id: 'e'.repeat(32),
      difficulty: 'easy',
      clubs: [
        { id: 'barcelona', name: 'Barcelona', hasCrest: true, logoUrl: '' },
        { id: 'psg', name: 'PSG', hasCrest: true, logoUrl: '' },
        {
          id: 'kocaelispor-q1',
          name: 'Kocaelispor',
          hasCrest: false,
          logoUrl: '',
        },
      ],
      options: ['a', 'b', 'c', 'd'].map(letter => ({
        id: letter.repeat(32),
        name: 'Player ' + letter,
      })),
    },
  },
};
const answered: GameState = {
  ...active,
  run: {
    ...active.run!,
    answered: 1,
    score: 1,
    question: { ...active.run!.question!, id: '1'.repeat(32) },
    feedback: {
      questionId: active.run!.question!.id,
      selectedOptionId: optionId,
      correctOptionId: optionId,
      correctName: 'Player a',
      correct: true,
    },
  },
};
beforeEach(() => jest.clearAllMocks());

test('the API boundary rejects malformed choices, missing stats and premature rewards', async () => {
  for (const value of [
    { ...active, stats: { played: 0 } },
    { ...active, hearts: 4 },
    { ...active, nextHeartAt: null },
    { ...active, run: { ...active.run, rewardGranted: true } },
    {
      ...active,
      run: {
        ...active.run,
        question: {
          ...active.run!.question,
          options: [null, null, null, null],
        },
      },
    },
  ]) {
    jest.mocked(request).mockResolvedValueOnce(value);
    await expect(gamesRepository.state('session')).rejects.toBeInstanceOf(
      ApiError,
    );
  }
  jest.mocked(request).mockResolvedValueOnce(structuredClone(active));
  const state = await gamesRepository.state('session');
  expect(state.run?.question?.clubs[0].logoUrl).toContain(
    '/v1/games/logos/barcelona',
  );
  // A club without a crest gets no logo URL; the board draws a badge.
  expect(state.run?.question?.clubs[2].logoUrl).toBe('');
});

test('clue clubs must say whether a crest exists and use catalog ids', async () => {
  const clubs = active.run!.question!.clubs;
  for (const bad of [
    [{ id: 'barcelona', name: 'Barcelona' }, ...clubs.slice(1)],
    [{ ...clubs[0], hasCrest: 'yes' }, ...clubs.slice(1)],
    [{ ...clubs[0], id: '../secret' }, ...clubs.slice(1)],
    [{ ...clubs[0], name: '' }, ...clubs.slice(1)],
    [...clubs, ...clubs],
  ]) {
    jest.mocked(request).mockResolvedValueOnce({
      ...active,
      run: {
        ...active.run,
        question: { ...active.run!.question, clubs: bad },
      },
    });
    await expect(gamesRepository.state('session')).rejects.toBeInstanceOf(
      ApiError,
    );
  }
});

test('club initials skip legal forms and handle one-word names', () => {
  expect(clubInitials('Real Madrid')).toBe('RM');
  expect(clubInitials('FC Bayern München')).toBe('BM');
  expect(clubInitials('Galatasaray')).toBe('GA');
  expect(clubInitials('1. FC Köln')).toBe('KÖ');
  expect(clubInitials('Beşiktaş J.K.')).toBe('BJ');
  expect(clubInitials('')).toBe('?');
});

test('the board shows crests for crest clubs and a name badge otherwise', async () => {
  const question = {
    ...active.run!.question!,
    clubs: active.run!.question!.clubs.map(c => ({
      ...c,
      logoUrl: c.hasCrest ? 'https://api.test/v1/games/logos/' + c.id : '',
    })),
  };
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <QuizBoard
        question={question}
        number={1}
        score={0}
        selected=""
        feedback={null}
        busy={false}
        error=""
        onAnswer={jest.fn()}
        onNext={jest.fn()}
        onRecover={jest.fn()}
      />,
    );
  });
  const images = renderer.root.findAllByType(Image);
  expect(images.map(i => i.props.accessibilityLabel)).toEqual([
    'Barcelona',
    'PSG',
  ]);
  const badge = renderer.root.findByProps({
    testID: 'club-badge-kocaelispor-q1',
  });
  expect(badge.props.accessibilityLabel).toBe('Kocaelispor');
  const texts = badge
    .findAll(n => typeof n.props.children === 'string')
    .map(n => n.props.children);
  expect(texts).toContain('KO');
  // A crest that fails to load falls back to the same badge.
  await act(async () => images[1].props.onError());
  expect(
    renderer.root.findAllByProps({ testID: 'club-badge-psg' }).length,
  ).toBeGreaterThan(0);
  await act(async () => renderer.unmount());
});

test('a lost answer response keeps the choice fixed; retry shows feedback before advancing', async () => {
  const service: GamesService = {
    state: jest.fn().mockResolvedValue(active),
    start: jest.fn().mockResolvedValue(active),
    penaltyStart: jest.fn(),
    penaltyKick: jest.fn(),
    answer: jest
      .fn()
      .mockRejectedValueOnce(new Error('Connection lost'))
      .mockResolvedValueOnce(answered),
  };
  let game!: ReturnType<typeof useFootballGame>;
  function Probe() {
    game = useFootballGame(service, 'session');
    return null;
  }
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<Probe />);
  });
  await act(async () => game.start());
  expect(game.remaining).toBe(10800);
  await act(async () => game.answer(optionId));
  expect(game.selected).toBe(optionId);
  expect(game.error).toBe('Connection lost');
  await act(async () => game.answer('b'.repeat(32)));
  expect(service.answer).toHaveBeenCalledTimes(1);
  await act(async () => game.answer(optionId));
  expect(game.feedback?.correct).toBe(true);
  expect(game.question?.id).toBe(active.run!.question!.id);
  expect(game.questionNumber).toBe(1);
  await act(async () => game.next());
  expect(game.question?.id).toBe(answered.run!.question!.id);
  expect(game.questionNumber).toBe(2);
  expect(game.selected).toBe('');
  await act(async () => renderer.unmount());
});

test('recovering a saved finish shows the reward without submitting another answer', async () => {
  const finished: GameState = {
    ...answered,
    stats: { played: 1, wins: 1, bestScore: 7, earnedCredits: 1 },
    run: {
      ...answered.run!,
      status: 'finished',
      answered: 10,
      score: 7,
      passed: true,
      rewardGranted: true,
      question: null,
    },
  };
  const service: GamesService = {
    state: jest.fn().mockResolvedValueOnce(active).mockResolvedValue(finished),
    start: jest.fn().mockResolvedValue(active),
    answer: jest.fn().mockRejectedValue(new Error('Connection lost')),
    penaltyStart: jest.fn(),
    penaltyKick: jest.fn(),
  };
  let game!: ReturnType<typeof useFootballGame>;
  function Probe() {
    game = useFootballGame(service, 'session');
    return null;
  }
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<Probe />);
  });
  await act(async () => game.start());
  await act(async () => game.answer(optionId));
  await act(async () => game.recover());
  expect(game.mode).toBe('result');
  expect(game.data?.run?.rewardGranted).toBe(true);
  expect(game.error).toBe('');
  expect(service.answer).toHaveBeenCalledTimes(1);
  await act(async () => renderer.unmount());
});

test('a heart refill uses server time and retries after a temporary connection failure', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2035-01-01T00:00:00Z'));
  const waiting: GameState = {
    ...active,
    hearts: 0,
    run: null,
    penalty: null,
    nextHeartAt: '2026-10-12T10:00:01Z',
  };
  const refilled: GameState = {
    ...waiting,
    hearts: 1,
    serverTime: '2026-10-12T10:00:32Z',
    nextHeartAt: '2026-10-12T13:00:01Z',
  };
  const service: GamesService = {
    state: jest
      .fn()
      .mockResolvedValueOnce(waiting)
      .mockRejectedValueOnce(new Error('Connection lost'))
      .mockResolvedValue(refilled),
    start: jest.fn(),
    answer: jest.fn(),
    penaltyStart: jest.fn(),
    penaltyKick: jest.fn(),
  };
  let game!: ReturnType<typeof useFootballGame>;
  function Probe() {
    game = useFootballGame(service, 'session');
    return null;
  }
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(game.remaining).toBe(1);
    await act(async () => jest.advanceTimersByTime(1000));
    expect(service.state).toHaveBeenCalledTimes(2);
    expect(game.data?.hearts).toBe(0);
    await act(async () => jest.advanceTimersByTime(30000));
    expect(service.state).toHaveBeenCalledTimes(3);
    expect(game.data?.hearts).toBe(1);
    expect(game.error).toBe('');
  } finally {
    await act(async () => renderer.unmount());
    jest.useRealTimers();
  }
});
