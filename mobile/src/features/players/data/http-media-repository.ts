import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import {
  appendMedia,
  pickMedia,
  releaseMedia,
} from '../../../shared/lib/media-picker';
import { mediaSource } from '../../../shared/lib/media-source';
import type {
  GalleryLimits,
  PlayerMediaItem,
  PlayerMediaRepository,
} from '../domain/media';

const id = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const count = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) >= 0;

export function validMediaItem(value: unknown): value is PlayerMediaItem {
  const item = value as PlayerMediaItem;
  return (
    !!item &&
    id(item.id) &&
    id(item.ownerId) &&
    ((item.kind === 'image' &&
      ['image/jpeg', 'image/png'].includes(item.mime)) ||
      (item.kind === 'video' && item.mime === 'video/mp4')) &&
    count(item.size) &&
    count(item.width) &&
    count(item.height) &&
    typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt))
  );
}
function validLimits(value: unknown): value is GalleryLimits {
  const limits = value as GalleryLimits;
  return !!limits && count(limits.photos) && count(limits.videos);
}

const mediaPath = (ownerId: string) => '/v1/players/' + ownerId + '/media';

export const playerMediaRepository: PlayerMediaRepository = {
  async list(token, ownerId) {
    const result = await request<{ items: unknown; limits: unknown }>(
      mediaPath(ownerId),
      { token },
    );
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(validMediaItem) ||
      !result.items.every(item => item.ownerId === ownerId) ||
      !validLimits(result.limits)
    )
      throw new ApiError(copy.form.unexpected);
    return { items: result.items, limits: result.limits };
  },
  pick: pickMedia,
  release: releaseMedia,
  async upload(token, media) {
    const formData = new FormData();
    appendMedia(formData, media);
    const result = await request<{ item: unknown }>('/v1/players/me/media', {
      method: 'POST',
      token,
      formData,
      timeoutMs: 90000,
    });
    if (!result || !validMediaItem(result.item))
      throw new ApiError(copy.form.unexpected);
    return result.item;
  },
  remove: (token, mediaId) =>
    request<void>('/v1/players/me/media/' + mediaId, {
      method: 'DELETE',
      token,
    }),
  source: (token, item) =>
    mediaSource(token, mediaPath(item.ownerId) + '/' + item.id),
};
