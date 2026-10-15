import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ApiError, request } from '../src/shared/api/client';
import { discoveryRepository } from '../src/features/discovery/data/http-discovery-repository';
import {
  createDiscoveryService,
  type DiscoveryService,
} from '../src/features/discovery/application/discovery-service';
import { useDiscovery } from '../src/features/discovery/application/useDiscovery';
import type {
  DiscoveryPage,
  DiscoveryQuery,
} from '../src/features/discovery/domain/models';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));
jest.mock('../src/features/players', () =>
  jest.requireActual('../src/features/players/domain/profile'),
);
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual('react').useEffect(effect, [effect]),
}));

const query: DiscoveryQuery = {
  kind: 'clubs',
  search: '',
  position: '',
  dominantFoot: '',
  availability: '',
  footballType: '',
  licenseStatus: '',
  page: 1,
};
const page: DiscoveryPage = {
  items: [
    {
      id: 'club',
      fullName: 'Test Club',
      role: 'club',
      verified: true,
      district: '',
      playerProfile: null,
      isFollowing: false,
    },
  ],
  page: 1,
  pageSize: 20,
  total: 1,
  totalPages: 1,
};
beforeEach(() => jest.clearAllMocks());

test('invalid and unverified discovery payloads are rejected at the API boundary', async () => {
  for (const payload of [
    null,
    { ...page, totalPages: 7 },
    { ...page, items: [{ ...page.items[0], verified: false }] },
    { ...page, items: [{ ...page.items[0], role: 'player' }] },
  ]) {
    jest.mocked(request).mockResolvedValueOnce(payload);
    await expect(
      discoveryRepository.list('session', query),
    ).rejects.toBeInstanceOf(ApiError);
  }
  jest.mocked(request).mockResolvedValueOnce({ profile: page.items[0] });
  await expect(
    discoveryRepository.get('session', 'clubs', 'another-id'),
  ).rejects.toBeInstanceOf(ApiError);
});

test('requests safely encode literal searches and the service clears player filters for providers', async () => {
  jest.mocked(request).mockResolvedValueOnce(page);
  await createDiscoveryService(discoveryRepository).list('session', {
    ...query,
    search: '  A&B_%  ',
    position: 'Forvet',
    dominantFoot: 'left',
    availability: 'seeking_team',
  });
  expect(request).toHaveBeenCalledWith(
    expect.stringContaining(
      'search=A%26B_%25&position=&dominantFoot=&availability=',
    ),
    { token: 'session' },
  );
});

test('late responses cannot overwrite a newer search, and refresh hides old results', async () => {
  let finishFirst!: (value: DiscoveryPage) => void;
  const first = new Promise<DiscoveryPage>(resolve => {
    finishFirst = resolve;
  });
  let finishRefresh!: (value: DiscoveryPage) => void;
  const refresh = new Promise<DiscoveryPage>(resolve => {
    finishRefresh = resolve;
  });
  const service: DiscoveryService = {
    list: jest
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(page)
      .mockReturnValueOnce(refresh),
    get: jest.fn(),
    insights: jest.fn(),
    follow: jest.fn(),
  };
  let state!: ReturnType<typeof useDiscovery>;
  function Probe({ value }: { value: DiscoveryQuery }) {
    state = useDiscovery(service, 'session', value);
    return null;
  }
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<Probe value={query} />);
  });
  await act(async () => {
    renderer.update(<Probe value={{ ...query, search: 'new' }} />);
  });
  expect(state.page).toEqual(page);
  await act(async () => {
    finishFirst({ ...page, items: [], total: 0, totalPages: 0 });
  });
  expect(state.page).toEqual(page);
  await act(async () => {
    state.refresh();
  });
  expect(state.loading).toBe(true);
  expect(state.page).toBeNull();
  await act(async () => {
    finishRefresh(page);
  });
  expect(state.loading).toBe(false);
  expect(state.page).toEqual(page);
  act(() => renderer.unmount());
});
