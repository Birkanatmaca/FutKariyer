import { ApiError, request } from '../../../shared/api/client';
import { config } from '../../../shared/lib/config';
import { copy } from '../../../shared/lib/copy';
import {
  popupFormats,
  type Advertisement,
  type Article,
  type ContentRepository,
  type HomeContent,
  type NewsPage,
  type PopupAd,
} from '../domain/models';
function imageID(value: unknown, optional = false) {
  return (
    typeof value === 'string' &&
    ((optional && value === '') || /^[a-f0-9]{32}$/.test(value))
  );
}
function base(value: unknown): value is Article {
  const item = value as Article;
  return (
    !!item &&
    imageID(item.id) &&
    typeof item.title === 'string' &&
    typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    typeof item.updatedAt === 'string' &&
    Number.isFinite(Date.parse(item.updatedAt))
  );
}
type AdvertisementPayload = Advertisement & {
  active: boolean;
  sortOrder: number;
};
function ad(value: unknown): value is AdvertisementPayload {
  const item = value as AdvertisementPayload;
  return (
    !!item &&
    imageID(item.id) &&
    imageID(item.imageId) &&
    item.active === true &&
    Number.isInteger(item.sortOrder) &&
    item.sortOrder >= 0 &&
    item.sortOrder <= 10000
  );
}
function article(value: unknown): value is Article {
  const item = value as Article;
  return (
    base(value) &&
    typeof item.summary === 'string' &&
    typeof item.body === 'string' &&
    imageID(item.imageId, true) &&
    item.published === true &&
    typeof item.showOnHome === 'boolean'
  );
}
function popup(value: unknown): value is PopupAd {
  const item = value as PopupAd;
  return (
    !!item &&
    imageID(item.id) &&
    imageID(item.imageId) &&
    Object.prototype.hasOwnProperty.call(popupFormats, item.format)
  );
}
export const contentRepository: ContentRepository = {
  async popup(token) {
    const out = await request<{ popup: unknown }>('/v1/content/popup', {
      token,
    });
    if (!out || (out.popup !== null && !popup(out.popup)))
      throw new ApiError(copy.form.unexpected);
    if (!out.popup) return null;
    const { id, imageId, format } = out.popup as PopupAd;
    return { id, imageId, format };
  },
  async popupViewed(token, id) {
    await request<void>(
      '/v1/content/popup/' + encodeURIComponent(id) + '/views',
      { method: 'POST', token },
    );
  },
  async home(token) {
    const out = await request<{
      advertisements: unknown[];
      news: Article[];
    }>('/v1/content/home', { token });
    if (
      !out ||
      !Array.isArray(out.advertisements) ||
      out.advertisements.length > 20 ||
      !out.advertisements.every(ad) ||
      !Array.isArray(out.news) ||
      out.news.length > 3 ||
      !out.news.every(item => article(item) && item.showOnHome)
    )
      throw new ApiError(copy.form.unexpected);
    // Only the picture reaches the home screen; admin titles are dropped here.
    const advertisements = (out.advertisements as AdvertisementPayload[]).map(
      ({ id, imageId }): Advertisement => ({ id, imageId }),
    );
    return { advertisements, news: out.news } satisfies HomeContent;
  },
  async news(token, page) {
    const out = await request<NewsPage>('/v1/content/news?page=' + page, {
      token,
    });
    if (
      !out ||
      !Array.isArray(out.items) ||
      !out.items.every(article) ||
      out.items.length > 20 ||
      out.page !== page ||
      out.pageSize !== 20 ||
      !Number.isSafeInteger(out.total) ||
      out.total < 0 ||
      out.totalPages !== Math.ceil(out.total / 20)
    )
      throw new ApiError(copy.form.unexpected);
    return out;
  },
  async article(token, id) {
    const out = await request<{ article: unknown }>(
      '/v1/content/news/' + encodeURIComponent(id),
      { token },
    );
    if (!out || !article(out.article) || out.article.id !== id)
      throw new ApiError(copy.form.unexpected);
    return out.article;
  },
  imageUrl(id) {
    return config.apiBaseUrl + '/v1/content/images/' + encodeURIComponent(id);
  },
};
