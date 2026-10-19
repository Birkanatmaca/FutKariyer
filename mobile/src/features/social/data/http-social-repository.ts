import { ApiError, request } from '../../../shared/api/client';
import {
  appendMedia,
  pickMedia,
  releaseMedia,
} from '../../../shared/lib/media-picker';
import { mediaSource } from '../../../shared/lib/media-source';
import { maxImageBytes, maxVideoBytes } from '../domain/models';
import { copy } from '../../../shared/lib/copy';
import type {
  SocialAuthor,
  SocialPage,
  SocialPost,
  SocialReply,
  SocialRepository,
} from '../domain/models';

const idValid = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const dateValid = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const countValid = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function authorValid(value: unknown): value is SocialAuthor {
  const author = value as SocialAuthor;
  return (
    !!author &&
    idValid(author.id) &&
    typeof author.fullName === 'string' &&
    ['player', 'club', 'coach'].includes(author.role) &&
    typeof author.verified === 'boolean' &&
    (author.isPro === undefined || typeof author.isPro === 'boolean') &&
    (author.avatarVersion === undefined ||
      (Number.isSafeInteger(author.avatarVersion) &&
        author.avatarVersion >= 0)) &&
    typeof author.following === 'boolean' &&
    (author.footballType === undefined ||
      ['unknown', 'amateur', 'professional', 'halisaha'].includes(
        author.footballType,
      )) &&
    (author.licenseStatus === undefined ||
      ['unknown', 'licensed', 'unlicensed'].includes(author.licenseStatus))
  );
}
function mediaValid(value: unknown): boolean {
  if (value === null) return true;
  const media = value as import('../domain/models').SocialMedia;
  if (
    !media ||
    !countValid(media.size) ||
    media.size === 0 ||
    !countValid(media.width) ||
    !countValid(media.height)
  )
    return false;
  return media.kind === 'image'
    ? ['image/jpeg', 'image/png'].includes(media.mime) &&
        media.size <= maxImageBytes &&
        media.width > 0 &&
        media.width <= 8192 &&
        media.height > 0 &&
        media.height <= 8192 &&
        media.width * media.height <= 16000000
    : media.kind === 'video' &&
        media.mime === 'video/mp4' &&
        media.size <= maxVideoBytes &&
        media.width === 0 &&
        media.height === 0;
}
function postValid(value: unknown): value is SocialPost {
  const post = value as SocialPost;
  return (
    !!post &&
    idValid(post.id) &&
    authorValid(post.author) &&
    typeof post.body === 'string' &&
    dateValid(post.createdAt) &&
    mediaValid(post.media) &&
    countValid(post.likeCount) &&
    countValid(post.replyCount) &&
    typeof post.liked === 'boolean' &&
    typeof post.owned === 'boolean' &&
    (post.showOnProfile === undefined ||
      typeof post.showOnProfile === 'boolean')
  );
}
function replyValid(value: unknown): value is SocialReply {
  const reply = value as SocialReply;
  return (
    !!reply &&
    idValid(reply.id) &&
    idValid(reply.postId) &&
    authorValid(reply.author) &&
    typeof reply.body === 'string' &&
    dateValid(reply.createdAt) &&
    typeof reply.owned === 'boolean'
  );
}
function validPage<T>(
  value: unknown,
  valid: (item: unknown) => item is T,
): SocialPage<T> {
  const page = value as SocialPage<T>;
  if (
    !page ||
    !Array.isArray(page.items) ||
    page.items.length > 20 ||
    !page.items.every(valid) ||
    typeof page.nextCursor !== 'string' ||
    page.nextCursor.length > 256
  )
    throw new ApiError(copy.form.unexpected);
  return page;
}
function validPost(value: { post?: unknown }) {
  if (!value || !postValid(value.post))
    throw new ApiError(copy.form.unexpected);
  return value.post;
}
const path = (id: string) => '/v1/social/posts/' + encodeURIComponent(id);
export const socialRepository: SocialRepository = {
  async feed(token, cursor, scope) {
    return validPage(
      await request<unknown>(
        '/v1/social/posts?scope=' +
          scope +
          '&cursor=' +
          encodeURIComponent(cursor),
        { token },
      ),
      postValid,
    );
  },
  async post(token, id) {
    return validPost(await request<{ post: unknown }>(path(id), { token }));
  },
  async userPosts(token, userId, cursor, filter) {
    return validPage(
      await request<unknown>(
        '/v1/social/users/' +
          encodeURIComponent(userId) +
          '/posts?cursor=' +
          encodeURIComponent(cursor) +
          (filter === 'media' ? '&filter=media' : ''),
        { token },
      ),
      postValid,
    );
  },
  async createPost(token, body, media, showOnProfile) {
    const formData = media ? new FormData() : undefined;
    if (formData && media) {
      formData.append('body', body);
      formData.append('showOnProfile', showOnProfile ? 'true' : 'false');
      appendMedia(formData, media);
    }
    return validPost(
      await request<{ post: unknown }>('/v1/social/posts', {
        method: 'POST',
        token,
        body: media ? undefined : { body },
        formData,
        timeoutMs: media ? 90000 : undefined,
      }),
    );
  },
  pickMedia,
  releaseMedia,
  mediaSource: (token, id) => mediaSource(token, path(id) + '/media'),
  async follow(token, id, following) {
    const result = await request<{ following: unknown }>(
      '/v1/social/users/' + encodeURIComponent(id) + '/follow',
      { method: 'PUT', token, body: { following } },
    );
    if (!result || typeof result.following !== 'boolean')
      throw new ApiError(copy.form.unexpected);
    return result.following;
  },
  deletePost: (token, id) =>
    request<void>(path(id), { method: 'DELETE', token }),
  async like(token, id, liked) {
    return validPost(
      await request<{ post: unknown }>(path(id) + '/like', {
        method: 'PUT',
        token,
        body: { liked },
      }),
    );
  },
  async replies(token, id, cursor) {
    const result = validPage(
      await request<unknown>(
        path(id) + '/replies?cursor=' + encodeURIComponent(cursor),
        { token },
      ),
      replyValid,
    );
    if (result.items.some(item => item.postId !== id))
      throw new ApiError(copy.form.unexpected);
    return result;
  },
  async createReply(token, id, body) {
    const result = await request<{ reply: unknown }>(path(id) + '/replies', {
      method: 'POST',
      token,
      body: { body },
    });
    if (!result || !replyValid(result.reply) || result.reply.postId !== id)
      throw new ApiError(copy.form.unexpected);
    return result.reply;
  },
  deleteReply: (token, postId, id) =>
    request<void>(path(postId) + '/replies/' + encodeURIComponent(id), {
      method: 'DELETE',
      token,
    }),
};
