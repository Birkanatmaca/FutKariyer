import React from 'react';
import { act, create } from 'react-test-renderer';
import { usePushRegistration } from '../src/features/notifications/application/usePushRegistration';
import { pushMessaging } from '../src/features/notifications/data/push-messaging';
import type {
  PushMessaging,
  PushRepository,
} from '../src/features/notifications/domain/push';

function Probe(props: {
  messaging: PushMessaging;
  repository: PushRepository;
  token: string | null;
  onOpen(): void;
}) {
  usePushRegistration(
    props.messaging,
    props.repository,
    props.token,
    props.onOpen,
  );
  return null;
}

function setup(over: Partial<PushMessaging> = {}) {
  let refresh: (token: string) => void = () => {};
  let opened: () => void = () => {};
  const messaging: PushMessaging = {
    platform: 'ios',
    requestToken: jest.fn().mockResolvedValue('device-1'),
    onTokenRefresh: jest.fn(listener => {
      refresh = listener;
      return jest.fn();
    }),
    onOpened: jest.fn(listener => {
      opened = listener;
      return jest.fn();
    }),
    openedFromPush: jest.fn().mockResolvedValue(false),
    ...over,
  };
  const repository: PushRepository = {
    register: jest.fn().mockResolvedValue(undefined),
  };
  return {
    messaging,
    repository,
    refresh: () => refresh,
    opened: () => opened,
  };
}

test('registers the device for a signed-in session and on token refresh', async () => {
  const { messaging, repository, refresh } = setup();
  await act(async () => {
    create(
      <Probe
        messaging={messaging}
        repository={repository}
        token="session"
        onOpen={jest.fn()}
      />,
    );
  });
  expect(repository.register).toHaveBeenCalledWith('session', {
    token: 'device-1',
    platform: 'ios',
  });
  await act(async () => refresh()('device-2'));
  expect(repository.register).toHaveBeenLastCalledWith('session', {
    token: 'device-2',
    platform: 'ios',
  });
});

test('does nothing signed out or without push, and opens the centre from a push', async () => {
  const signedOut = setup();
  await act(async () => {
    create(
      <Probe
        messaging={signedOut.messaging}
        repository={signedOut.repository}
        token={null}
        onOpen={jest.fn()}
      />,
    );
  });
  expect(signedOut.messaging.requestToken).not.toHaveBeenCalled();

  const denied = setup({ requestToken: jest.fn().mockResolvedValue(null) });
  const onOpen = jest.fn();
  await act(async () => {
    create(
      <Probe
        messaging={denied.messaging}
        repository={denied.repository}
        token="session"
        onOpen={onOpen}
      />,
    );
  });
  expect(denied.repository.register).not.toHaveBeenCalled();
  act(() => denied.opened()());
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test('an unconfigured Firebase keeps push off instead of crashing', async () => {
  await expect(pushMessaging.requestToken()).resolves.toBeNull();
  expect(pushMessaging.onTokenRefresh(() => {})).toEqual(expect.any(Function));
});
