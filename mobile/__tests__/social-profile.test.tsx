import React from 'react';
import { act, create } from 'react-test-renderer';
import { request } from '../src/shared/api/client';
import { socialRepository } from '../src/features/social/data/http-social-repository';
import { createSocialService } from '../src/features/social/application/social-service';
import { SocialPostCard } from '../src/features/social/ui/SocialPostCard';
import type { SocialPost } from '../src/features/social/domain/models';

jest.mock('../src/features/players', () =>
  jest.requireActual('../src/features/players/domain/profile'),
);
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);
jest.mock('react-native-video', () => () => null);
jest.mock('../src/features/social/ui/PostMedia', () => ({
  PostMedia: () => null,
}));
jest.mock('../src/features/social/ui/CommentPreview', () => ({
  CommentPreview: () => null,
}));
jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));

const id = 'a'.repeat(32);
const profile = {
  id,
  fullName: 'Golden FK',
  role: 'club',
  verified: true,
  isPro: false,
  avatarVersion: 0,
  following: false,
  footballType: 'halisaha',
  licenseStatus: 'unknown',
  posts: 3,
  followers: 12,
  followingCount: 4,
  self: false,
  discovery: false,
  playerProfile: null,
};
beforeEach(() => jest.clearAllMocks());

test('a post author profile is read from the social profile endpoint and validated', async () => {
  const service = createSocialService(socialRepository);
  (request as jest.Mock).mockResolvedValueOnce({ profile });
  await expect(service.profile('token', id)).resolves.toMatchObject({
    followers: 12,
    followingCount: 4,
    discovery: false,
  });
  expect(request).toHaveBeenCalledWith('/v1/social/users/' + id + '/profile', {
    token: 'token',
  });
  for (const payload of [
    null,
    { profile: { ...profile, followers: -1 } },
    { profile: { ...profile, role: 'organizer' } },
    { profile: { ...profile, self: 'no' } },
    // A football card only comes with a player the viewer may discover.
    {
      profile: {
        ...profile,
        playerProfile: {
          position: 'Forvet',
          dominantFoot: 'right',
          experienceYears: 3,
          currentClub: '',
          availability: 'seeking_team',
          discoverable: true,
          footballType: 'halisaha',
          licenseStatus: 'licensed',
          updatedAt: '2026-10-22T10:00:00Z',
        },
      },
    },
  ]) {
    (request as jest.Mock).mockResolvedValueOnce(payload);
    await expect(service.profile('token', id)).rejects.toThrow();
  }
});

test("a post's photo and name open its author's profile", () => {
  const post: SocialPost = {
    id: 'b'.repeat(32),
    author: { ...profile, role: 'club', following: false },
    body: 'Maç günü',
    createdAt: '2026-10-22T10:00:00Z',
    likeCount: 0,
    replyCount: 0,
    liked: false,
    owned: false,
    media: null,
  } as unknown as SocialPost;
  const onAuthor = jest.fn();
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <SocialPostCard
        item={post}
        token="token"
        service={createSocialService(socialRepository)}
        onDelete={() => undefined}
        onAuthor={onAuthor}
      />,
    );
  });
  const link = tree.root.find(
    node =>
      node.props.accessibilityLabel === 'Golden FK profilini aç' &&
      typeof node.props.onPress === 'function',
  );
  expect(link).toBeTruthy();
  act(() => link!.props.onPress());
  expect(onAuthor).toHaveBeenCalledTimes(1);
});
