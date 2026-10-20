import type { AdminGateway, PopupAd, PopupsRepository } from '../domain/models';
import {
  isId,
  isOneOf,
  isPage,
  isRecord,
  isText,
  isTimestamp,
  segment,
  unexpected,
} from './validators';

function within(value: unknown, min: number, max: number) {
  return (
    Number.isInteger(value) &&
    (value as number) >= min &&
    (value as number) <= max
  );
}
export function isPopupAd(value: unknown): value is PopupAd {
  return (
    isRecord(value) &&
    isId(value.id) &&
    isText(value.title) &&
    isId(value.imageId) &&
    isOneOf(value.format, ['square', 'portrait', 'story']) &&
    typeof value.active === 'boolean' &&
    within(value.intervalMinutes, 1, 43200) &&
    within(value.maxViews, 1, 100) &&
    within(value.views, 0, Number.MAX_SAFE_INTEGER) &&
    within(value.viewers, 0, Number.MAX_SAFE_INTEGER) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  );
}
const path = (id?: string) =>
  '/v1/admin/content/popups' + (id ? '/' + segment(id) : '');

export function createPopupsRepository(
  gateway: AdminGateway,
): PopupsRepository {
  return {
    async list(page) {
      const result = await gateway.request<unknown>(path() + '?page=' + page);
      if (!isPage(result, isPopupAd, page, 20)) unexpected();
      return result;
    },
    async save(form, id) {
      const result = await gateway.request<unknown>(path(id), {
        method: id ? 'PUT' : 'POST',
        body: {
          title: form.title,
          imageId: form.imageId,
          active: form.active,
          intervalMinutes: form.intervalMinutes,
          maxViews: form.maxViews,
        },
      });
      if (!isRecord(result) || !isPopupAd(result.popup)) unexpected();
    },
    async remove(id) {
      await gateway.request<void>(path(id), { method: 'DELETE' });
    },
  };
}
