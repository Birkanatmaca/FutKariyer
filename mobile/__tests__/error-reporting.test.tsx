import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ApiError, request } from '../src/shared/api/client';
import {
  reportError,
  resetCrashReporting,
  setCurrentScreen,
} from '../src/shared/lib/crash-report';
import { ErrorBoundary } from '../src/shared/ui/ErrorBoundary';
import { copy } from '../src/shared/lib/copy';

jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 204 });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  resetCrashReporting();
});

test('server faults carry a short support code from X-Request-ID', async () => {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status: 500,
    headers: { get: () => '01a15ac5bdd87a92017396c2' },
    json: async () => ({ error: { message: 'İşlem tamamlanamadı.' } }),
  });
  const failure = (await request('/v1/leagues').catch(e => e)) as ApiError;
  expect(failure).toBeInstanceOf(ApiError);
  expect(failure.requestId).toBe('01a15ac5bdd87a92017396c2');
  expect(failure.message).toBe(
    'İşlem tamamlanamadı. ' + copy.form.supportCode('017396c2'),
  );
  const [, init] = fetchMock.mock.calls[0];
  expect(init.headers['X-Client']).toBeTruthy();
  expect(init.headers['X-App-Version']).toBeTruthy();
});

test('client mistakes keep the plain message', async () => {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status: 422,
    headers: { get: () => 'abcdefabcdefabcdefabcdef' },
    json: async () => ({ error: { message: 'Bilgileri kontrol et.' } }),
  });
  const failure = (await request('/v1/x').catch(e => e)) as ApiError;
  expect(failure.message).toBe('Bilgileri kontrol et.');
});

test('errors are reported once a minute with screen and version', () => {
  setCurrentScreen('SocialFeed');
  reportError({ error: new TypeError('x is undefined'), fatal: true });
  reportError({ error: new TypeError('x is undefined'), fatal: true });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toMatch(/\/v1\/client-errors$/);
  const body = JSON.parse(init.body);
  expect(body).toMatchObject({
    source: 'mobile',
    message: 'TypeError: x is undefined',
    screen: 'SocialFeed',
    fatal: true,
  });
  expect(init.headers.Authorization).toBeUndefined();
});

function Broken(): React.ReactElement {
  throw new Error('render failed');
}

test('a render error shows the retry screen and is reported', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
  });
  const texts = renderer.root
    .findAllByType(Text)
    .map(node => node.props.children);
  expect(texts).toContain(copy.crash.title);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).message).toBe(
    'Error: render failed',
  );
  spy.mockRestore();
  await act(async () => renderer.unmount());
});
