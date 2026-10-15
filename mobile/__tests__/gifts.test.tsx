import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ApiError, request } from '../src/shared/api/client';
import { giftsRepository } from '../src/features/gifts/data/http-gifts-repository';
import { useGifts } from '../src/features/gifts/application/useGifts';
import type { GiftsService } from '../src/features/gifts/application/gifts-service';
import type { Gift, GiftInbox } from '../src/features/gifts/domain/models';
import { copy } from '../src/shared/lib/copy';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual('react').useEffect(effect, [effect]),
}));

const available: Gift = {
  id: 'gift_one',
  kind: 'heart_one',
  title: 'Kalp hediyesi',
  message: 'Yeni bir oyun için kalp.',
  status: 'available',
  createdAt: '2026-10-10T10:00:00Z',
  expiresAt: '2026-10-20T10:00:00Z',
  claimedAt: null,
};
const inbox: GiftInbox = {
  items: [available],
  availableCount: 1,
  serverTime: '2026-10-12T10:00:00Z',
};
const claimed: Gift = {
  ...available,
  status: 'claimed',
  claimedAt: '2026-10-12T10:01:00Z',
};

beforeEach(() => jest.clearAllMocks());

test('the API boundary accepts valid gifts and rejects malformed payloads', async () => {
  jest.mocked(request).mockResolvedValueOnce(structuredClone(inbox));
  await expect(giftsRepository.list('session')).resolves.toEqual(inbox);

  const malformed = [
    { ...inbox, items: [{ ...available, kind: 'gold_star' }] },
    { ...inbox, items: [{ ...available, status: 'pending' }] },
    { ...inbox, items: [{ ...available, expiresAt: 'soon' }] },
    { ...inbox, items: [{ ...available, claimedAt: 42 }] },
    { ...inbox, items: [null] },
    { ...inbox, availableCount: -1 },
    { ...inbox, availableCount: undefined },
    { items: [] },
  ];
  for (const value of malformed) {
    jest.mocked(request).mockResolvedValueOnce(value);
    await expect(giftsRepository.list('session')).rejects.toBeInstanceOf(
      ApiError,
    );
  }

  jest.mocked(request).mockResolvedValueOnce({
    result: 'claimed',
    items: [claimed],
    availableCount: 0,
    serverTime: '2026-10-12T10:01:00Z',
  });
  await expect(
    giftsRepository.claim('session', 'gift_one'),
  ).resolves.toMatchObject({ result: 'claimed', availableCount: 0 });
  expect(request).toHaveBeenLastCalledWith('/v1/gifts/gift_one/claim', {
    token: 'session',
    method: 'POST',
  });

  jest.mocked(request).mockResolvedValueOnce({ ...inbox, result: 'maybe' });
  await expect(
    giftsRepository.claim('session', 'gift_one'),
  ).rejects.toBeInstanceOf(ApiError);
});

test('claiming updates the inbox, shows the server result and ignores repeated taps while busy', async () => {
  let release!: () => void;
  const service: GiftsService = {
    list: jest
      .fn()
      .mockResolvedValueOnce(inbox)
      .mockResolvedValue({ ...inbox, items: [claimed], availableCount: 0 }),
    claim: jest.fn(
      () =>
        new Promise(resolve => {
          release = () =>
            resolve({
              result: 'claimed',
              items: [claimed],
              availableCount: 0,
              serverTime: '2026-10-12T10:01:00Z',
            });
        }),
    ),
  };
  let gifts!: ReturnType<typeof useGifts>;
  function Probe() {
    gifts = useGifts(service, 'session');
    return null;
  }
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<Probe />);
  });
  expect(gifts.availableCount).toBe(1);
  expect(gifts.items).toEqual([available]);

  let first!: Promise<void>;
  await act(async () => {
    first = gifts.claim('gift_one');
    gifts.claim('gift_one');
  });
  expect(service.claim).toHaveBeenCalledTimes(1);
  expect(gifts.claimingId).toBe('gift_one');

  await act(async () => {
    release();
    await first;
  });
  expect(service.claim).toHaveBeenCalledWith('session', 'gift_one');
  expect(gifts.claimingId).toBe('');
  expect(gifts.notice).toBe(copy.gifts.claimed);
  expect(gifts.error).toBe('');
  expect(gifts.availableCount).toBe(0);
  expect(gifts.items).toEqual([claimed]);
  await act(async () => renderer.unmount());
});

test('a claim rejected as expired shows the error and reloads the current status', async () => {
  const expired: Gift = { ...available, status: 'expired' };
  const service: GiftsService = {
    list: jest
      .fn()
      .mockResolvedValueOnce(inbox)
      .mockResolvedValue({
        items: [expired],
        availableCount: 0,
        serverTime: inbox.serverTime,
      }),
    claim: jest
      .fn()
      .mockRejectedValue(new ApiError('Hediyenin süresi dolmuş.', 409)),
  };
  let gifts!: ReturnType<typeof useGifts>;
  function Probe() {
    gifts = useGifts(service, 'session');
    return null;
  }
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<Probe />);
  });
  await act(async () => gifts.claim('gift_one'));
  expect(gifts.error).toBe('Hediyenin süresi dolmuş.');
  expect(gifts.notice).toBe('');
  expect(gifts.claimingId).toBe('');
  expect(service.list).toHaveBeenCalledTimes(2);
  expect(gifts.items).toEqual([expired]);
  expect(gifts.availableCount).toBe(0);
  await act(async () => renderer.unmount());
});
