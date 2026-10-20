import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import {
  popupFormats,
  popupLimits,
  type Popup,
  type PopupPage,
  type PopupRepository,
} from '../domain/models';

const hex = /^[a-f0-9]{32}$/;
const count = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) >= 0;
function between(value: unknown, range: { min: number; max: number }) {
  return (
    Number.isInteger(value) &&
    Number(value) >= range.min &&
    Number(value) <= range.max
  );
}
function valid(value: unknown): value is Popup {
  const item = value as Popup;
  return (
    !!item &&
    typeof item.id === 'string' &&
    hex.test(item.id) &&
    typeof item.title === 'string' &&
    typeof item.imageId === 'string' &&
    hex.test(item.imageId) &&
    popupFormats.includes(item.format) &&
    typeof item.active === 'boolean' &&
    between(item.intervalMinutes, popupLimits.interval) &&
    between(item.maxViews, popupLimits.views) &&
    count(item.views) &&
    count(item.viewers) &&
    typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    typeof item.updatedAt === 'string' &&
    Number.isFinite(Date.parse(item.updatedAt))
  );
}
const path = (id?: string) =>
  '/v1/admin/content/popups' + (id ? '/' + encodeURIComponent(id) : '');

export const popupRepository: PopupRepository = {
  async list(page) {
    const result = await request<PopupPage>(path() + '?page=' + page);
    if (
      !result ||
      !Array.isArray(result.items) ||
      result.items.length > 20 ||
      !result.items.every(valid) ||
      result.page !== page ||
      result.pageSize !== 20 ||
      !count(result.total) ||
      result.totalPages !== Math.ceil(result.total / 20)
    )
      throw new ApiError(copy.form.unexpected);
    return result;
  },
  async save(form, id) {
    const out = await request<{ popup?: unknown }>(path(id), {
      method: id ? 'PUT' : 'POST',
      body: {
        title: form.title,
        imageId: form.imageId,
        active: form.active,
        intervalMinutes: form.intervalMinutes,
        maxViews: form.maxViews,
      },
    });
    if (!out || !valid(out.popup)) throw new ApiError(copy.form.unexpected);
    return out.popup;
  },
  async remove(id) {
    await request<void>(path(id), { method: 'DELETE' });
  },
};
