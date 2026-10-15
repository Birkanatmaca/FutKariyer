import type {
  AdminGateway,
  Advertisement,
  Article,
  ContentItem,
  ContentRepository,
  ContentSection,
} from '../domain/models';
import { appendImage } from './image-picker';
import {
  idPattern,
  isId,
  isListOf,
  isOneOf,
  isPage,
  isRecord,
  isText,
  isTimestamp,
  segment,
  unexpected,
} from './validators';

function isBase(value: unknown) {
  return (
    isRecord(value) &&
    isId(value.id) &&
    isText(value.title) &&
    isText(value.imageId) &&
    (value.imageId === '' || idPattern.test(value.imageId)) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  );
}
export function isAdvertisement(value: unknown): value is Advertisement {
  return (
    isBase(value) &&
    isRecord(value) &&
    value.imageId !== '' &&
    typeof value.active === 'boolean' &&
    Number.isInteger(value.sortOrder) &&
    (value.sortOrder as number) >= 0 &&
    (value.sortOrder as number) <= 10000
  );
}
export function isArticle(value: unknown): value is Article {
  return (
    isBase(value) &&
    isRecord(value) &&
    isText(value.summary) &&
    isText(value.body) &&
    typeof value.published === 'boolean' &&
    typeof value.showOnHome === 'boolean' &&
    (value.reviewStatus === undefined ||
      isOneOf(value.reviewStatus, ['', 'pending', 'approved', 'rejected'])) &&
    (value.authorName === undefined || isText(value.authorName))
  );
}
function isItem(section: ContentSection) {
  return (value: unknown): value is ContentItem =>
    section === 'ads' ? isAdvertisement(value) : isArticle(value);
}
function path(section: ContentSection, id?: string) {
  return '/v1/admin/content/' + section + (id ? '/' + segment(id) : '');
}

export function createContentRepository(
  gateway: AdminGateway,
): ContentRepository {
  return {
    async list(section, page) {
      const result = await gateway.request<unknown>(
        path(section) + '?page=' + page,
      );
      if (!isPage(result, isItem(section), page, 20)) unexpected();
      return result;
    },
    async save(section, form, id) {
      const body =
        section === 'ads'
          ? {
              title: form.title,
              imageId: form.imageId,
              active: form.active,
              sortOrder: form.sortOrder,
            }
          : {
              title: form.title,
              summary: form.summary,
              body: form.body,
              imageId: form.imageId,
              published: form.published,
              showOnHome: form.showOnHome,
            };
      const result = await gateway.request<unknown>(path(section, id), {
        method: id ? 'PUT' : 'POST',
        body,
      });
      if (
        !isRecord(result) ||
        !(section === 'ads'
          ? isAdvertisement(result.advertisement)
          : isArticle(result.article))
      )
        unexpected();
    },
    async remove(section, id) {
      await gateway.request<void>(path(section, id), { method: 'DELETE' });
    },
    async pendingReviews() {
      const result = await gateway.request<unknown>(
        '/v1/admin/content/reviews',
      );
      if (!isRecord(result) || !isListOf(result.items, isArticle)) unexpected();
      return result.items as Article[];
    },
    async review(id, decision) {
      const result = await gateway.request<unknown>(
        path('news', id) + '/review',
        { method: 'PUT', body: { decision } },
      );
      if (!isRecord(result) || !isArticle(result.article)) unexpected();
    },
    async upload(image) {
      const form = new FormData();
      appendImage(form, image);
      const result = await gateway.request<unknown>(
        '/v1/admin/content/images',
        { method: 'POST', formData: form },
      );
      if (!isRecord(result) || !isId(result.imageId)) unexpected();
      return result.imageId as string;
    },
    imageSource: id => gateway.imageSource(id),
  };
}
