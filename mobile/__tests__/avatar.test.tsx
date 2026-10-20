import React from 'react';
import { Image } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AvatarTokenProvider, avatarUrl } from '../src/shared/lib/avatar';
import { Avatar } from '../src/shared/ui/Avatar';

// Photos are served only to signed-in accounts (20 Oct 2026), so every
// avatar request carries the session token.
test('avatar requests carry the session token', async () => {
  const uri = avatarUrl('a'.repeat(32), 3);
  expect(uri).toContain('/v1/users/' + 'a'.repeat(32) + '/avatar?v=3');
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <AvatarTokenProvider value="session-token">
        <Avatar name="Deniz Kaya" uri={uri} size={40} />
      </AvatarTokenProvider>,
    );
  });
  expect(renderer.root.findByType(Image).props.source).toEqual({
    uri,
    headers: { Authorization: 'Bearer session-token' },
  });
  await act(async () => renderer.unmount());
});

test('without a photo the initials show', async () => {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <AvatarTokenProvider value="session-token">
        <Avatar
          name="Deniz Kaya"
          uri={avatarUrl('b'.repeat(32), 0)}
          size={40}
        />
      </AvatarTokenProvider>,
    );
  });
  expect(renderer.root.findAllByType(Image)).toHaveLength(0);
  await act(async () => renderer.unmount());
});
