import { ApiError, request } from '../src/shared/api/client';
import { contentRepository } from '../src/features/content/data/http-content-repository';
import { discoveryRepository } from '../src/features/discovery/data/http-discovery-repository';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));
jest.mock('../src/features/players', () =>
  jest.requireActual('../src/features/players/domain/profile'),
);

const article = {
  id: 'a'.repeat(32),
  title: 'Stored headline',
  summary: 'Summary',
  body: 'Article text',
  imageId: '',
  published: true,
  showOnHome: true,
  createdAt: '2026-10-11T10:00:00Z',
  updatedAt: '2026-10-11T10:00:00Z',
};
beforeEach(() => jest.clearAllMocks());

test('home rejects draft or unfeatured news and invalid editorial image identifiers', async () => {
  for (const news of [
    { ...article, published: false },
    { ...article, showOnHome: false },
    { ...article, imageId: '../private-image' },
  ]) {
    jest
      .mocked(request)
      .mockResolvedValueOnce({ advertisements: [], news: [news] });
    await expect(contentRepository.home('session')).rejects.toBeInstanceOf(
      ApiError,
    );
  }
  jest
    .mocked(request)
    .mockResolvedValueOnce({ advertisements: [], news: [article] });
  await expect(contentRepository.home('session')).resolves.toEqual({
    advertisements: [],
    news: [article],
  });
  expect(request).toHaveBeenLastCalledWith('/v1/content/home', {
    token: 'session',
  });
});

test('article identity and personal counters are validated before being displayed', async () => {
  jest.mocked(request).mockResolvedValueOnce({ article });
  await expect(
    contentRepository.article('session', 'b'.repeat(32)),
  ).rejects.toBeInstanceOf(ApiError);
  for (const profileViews of [-1, 1.2, Number.MAX_SAFE_INTEGER + 1]) {
    jest
      .mocked(request)
      .mockResolvedValueOnce({ profileViews, followers: 0, following: 0 });
    await expect(
      discoveryRepository.insights('session'),
    ).rejects.toBeInstanceOf(ApiError);
  }
  jest
    .mocked(request)
    .mockResolvedValueOnce({ profileViews: 4, followers: 2, following: 1 });
  await expect(discoveryRepository.insights('session')).resolves.toEqual({
    profileViews: 4,
    followers: 2,
    following: 1,
  });
});
