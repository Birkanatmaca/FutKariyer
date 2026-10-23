import { copy } from '../../../shared/lib/copy';
import {
  maxPostLength,
  maxImageBytes,
  maxVideoBytes,
  type FeedScope,
  type FollowListKind,
  type UserPostsFilter,
  type MediaKind,
  type SelectedMedia,
  type SocialRepository,
} from '../domain/models';

function cleanBody(value: string) {
  const body = value.trim().replace(/\r\n/g, '\n');
  if (!body || Array.from(body).length > maxPostLength) {
    throw new Error(copy.social.bodyError);
  }
  return body;
}
export function createSocialService(repository: SocialRepository) {
  return {
    feed: (token: string, cursor = '', scope: FeedScope = 'explore') =>
      repository.feed(token, cursor, scope),
    post: (token: string, id: string) => repository.post(token, id),
    userPosts: (
      token: string,
      userId: string,
      cursor = '',
      filter: UserPostsFilter = 'all',
    ) => repository.userPosts(token, userId, cursor, filter),
    // showOnProfile only applies to a post with a photo or video.
    createPost: (
      token: string,
      body: string,
      media?: SelectedMedia,
      showOnProfile = false,
    ) => {
      if (!body.trim() && !media) throw new Error(copy.social.emptyPost);
      if (media) validateMedia(media);
      return repository.createPost(
        token,
        body.trim() ? cleanBody(body) : '',
        media,
        !!media && showOnProfile,
      );
    },
    pickMedia: async (kind: MediaKind) => {
      const media = await repository.pickMedia(kind);
      if (media) {
        try {
          validateMedia(media);
        } catch (error) {
          repository.releaseMedia(media);
          throw error;
        }
      }
      return media;
    },
    releaseMedia: (media: SelectedMedia) => repository.releaseMedia(media),
    mediaSource: (token: string, id: string) =>
      repository.mediaSource(token, id),
    follows: (
      token: string,
      userId: string,
      kind: FollowListKind,
      cursor = '',
    ) => repository.follows(token, userId, kind, cursor),
    profile: (token: string, userId: string) =>
      repository.profile(token, userId),
    follow: (token: string, id: string, following: boolean) =>
      repository.follow(token, id, following),
    deletePost: (token: string, id: string) => repository.deletePost(token, id),
    like: (token: string, id: string, liked: boolean) =>
      repository.like(token, id, liked),
    replies: (token: string, id: string, cursor = '') =>
      repository.replies(token, id, cursor),
    createReply: (token: string, id: string, body: string) =>
      repository.createReply(token, id, cleanBody(body)),
    deleteReply: (token: string, postId: string, id: string) =>
      repository.deleteReply(token, postId, id),
  };
}
export type SocialService = ReturnType<typeof createSocialService>;

function validateMedia(media: SelectedMedia) {
  const image = media.kind === 'image';
  const allowed = image ? ['image/jpeg', 'image/png'] : ['video/mp4'];
  if (
    !media.uri ||
    !Number.isSafeInteger(media.size) ||
    media.size < 1 ||
    media.size > (image ? maxImageBytes : maxVideoBytes) ||
    !allowed.includes(media.mime)
  ) {
    throw new Error(
      image ? copy.social.invalidImage : copy.social.invalidVideo,
    );
  }
}
