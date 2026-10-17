import { ApiError, request } from '../src/shared/api/client';
import { ratingRepository } from '../src/features/rating/data/http-rating-repository';
import {
  countdownTarget,
  splitDuration,
  type RatingBoard,
} from '../src/features/rating/domain/models';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));

const board: RatingBoard = {
  season: {
    id: 'a'.repeat(32),
    title: 'Ekim Sezonu',
    description: '',
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2026-11-01T00:00:00Z',
    prizes: [
      { place: 1, title: 'İmzalı forma' },
      { place: 2, title: 'Krampon' },
    ],
    status: 'active',
  },
  serverTime: '2026-10-17T10:00:00Z',
  leaderboard: [
    {
      rank: 1,
      userId: 'b'.repeat(32),
      fullName: 'Ali Yılmaz',
      role: 'player',
      points: 42,
    },
  ],
  me: { rank: 0, points: 0 },
  tasks: [
    { kind: 'share_post', target: 1, points: 5, progress: 1, claimed: false },
  ],
};

beforeEach(() => jest.clearAllMocks());

test('the rating board is validated at the API boundary', async () => {
  for (const value of [
    { ...board, season: { ...board.season, status: 'draft' } },
    {
      ...board,
      season: { ...board.season, prizes: [{ place: 4, title: 'x' }] },
    },
    { ...board, leaderboard: [{ ...board.leaderboard[0], rank: 0 }] },
    { ...board, tasks: [{ ...board.tasks[0], kind: 'win_lottery' }] },
    { ...board, me: { rank: -1, points: 0 } },
    { ...board, serverTime: 'yesterday' },
  ]) {
    jest.mocked(request).mockResolvedValueOnce(value);
    await expect(ratingRepository.board('s')).rejects.toBeInstanceOf(ApiError);
  }
  jest.mocked(request).mockResolvedValueOnce(structuredClone(board));
  await expect(ratingRepository.board('s')).resolves.toEqual(board);
  jest
    .mocked(request)
    .mockResolvedValueOnce({ ...board, season: null, me: null });
  await expect(ratingRepository.board('s')).resolves.toMatchObject({
    season: null,
  });
});

test('claiming a task posts to the task and returns the new board', async () => {
  jest.mocked(request).mockResolvedValueOnce(structuredClone(board));
  await ratingRepository.claim('s', 'share_post');
  expect(request).toHaveBeenLastCalledWith(
    '/v1/rating/tasks/share_post/claim',
    {
      token: 's',
      method: 'POST',
    },
  );
});

test('the countdown targets the start of an upcoming season, else its end', () => {
  expect(countdownTarget(board.season!)).toBe(board.season!.endsAt);
  expect(countdownTarget({ ...board.season!, status: 'upcoming' })).toBe(
    board.season!.startsAt,
  );
  expect(splitDuration(2 * 86400 + 3 * 3600 + 4 * 60 + 5)).toEqual({
    days: 2,
    hours: 3,
    minutes: 4,
    seconds: 5,
  });
  expect(splitDuration(-10)).toEqual({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
});
