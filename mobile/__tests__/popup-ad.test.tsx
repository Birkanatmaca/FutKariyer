import React from 'react';
import { Image, Modal } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ApiError, request } from '../src/shared/api/client';
import { contentRepository } from '../src/features/content/data/http-content-repository';
import { LaunchPopup } from '../src/features/content/ui/LaunchPopup';
import type { ContentService } from '../src/features/content';
import { copy } from '../src/shared/lib/copy';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);

const due = { id: 'a'.repeat(32), imageId: 'b'.repeat(32), format: 'portrait' };
beforeEach(() => jest.clearAllMocks());

test('the popup endpoint accepts only a known format or null', async () => {
  jest.mocked(request).mockResolvedValueOnce({ popup: null });
  await expect(contentRepository.popup('session')).resolves.toBeNull();
  jest
    .mocked(request)
    .mockResolvedValueOnce({ popup: { ...due, title: 'admin only' } });
  await expect(contentRepository.popup('session')).resolves.toEqual(due);
  for (const popup of [
    { ...due, format: 'banner' },
    { ...due, imageId: '../secret' },
  ]) {
    jest.mocked(request).mockResolvedValueOnce({ popup });
    await expect(contentRepository.popup('session')).rejects.toBeInstanceOf(
      ApiError,
    );
  }
  jest.mocked(request).mockResolvedValueOnce(undefined);
  await contentRepository.popupViewed('session', due.id);
  expect(request).toHaveBeenLastCalledWith(
    '/v1/content/popup/' + due.id + '/views',
    { method: 'POST', token: 'session' },
  );
});

function service(popup: unknown) {
  return {
    popup: jest.fn().mockResolvedValue(popup),
    popupViewed: jest.fn().mockResolvedValue(undefined),
    imageUrl: (id: string) => 'https://example.test/' + id,
  } as unknown as ContentService & {
    popup: jest.Mock;
    popupViewed: jest.Mock;
  };
}
async function render(element: React.ReactElement) {
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(element);
  });
  return root;
}

test('a due popup opens once its image loads and counts one showing', async () => {
  const prefetch = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
  const ads = service(due);
  const root = await render(<LaunchPopup token="session" service={ads} />);
  expect(prefetch).toHaveBeenCalledWith('https://example.test/' + due.imageId);
  expect(root.root.findByType(Modal).props.visible).toBe(true);
  expect(ads.popupViewed).toHaveBeenCalledTimes(1);
  expect(ads.popupViewed).toHaveBeenCalledWith('session', due.id);
  const close = root.root.findAll(
    node =>
      node.props.accessibilityLabel === copy.popupAd.close &&
      typeof node.props.onPress === 'function',
  )[0];
  await act(async () => close.props.onPress());
  expect(root.root.findByType(Modal).props.visible).toBe(false);
  expect(ads.popupViewed).toHaveBeenCalledTimes(1);
  // React Native loads Modal lazily on first render; a cold cache is slow.
}, 20000);

test('no popup for a switched coach, and none counted if the image fails', async () => {
  jest.spyOn(Image, 'prefetch').mockResolvedValue(false);
  const skipped = service(due);
  await render(
    <LaunchPopup token="session" service={skipped} enabled={false} />,
  );
  expect(skipped.popup).not.toHaveBeenCalled();
  const broken = service(due);
  const root = await render(<LaunchPopup token="session" service={broken} />);
  expect(root.root.findAllByType(Modal)).toHaveLength(0);
  expect(broken.popupViewed).not.toHaveBeenCalled();
});
