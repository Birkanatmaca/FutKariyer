import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  Article,
  ContentItem,
  ContentRepository,
  ContentSection,
  ContentPage,
  ReviewDecision,
  ReviewStatus,
} from '../domain/models';
function valid(value: unknown, section: ContentSection): value is ContentItem {
  const item = value as ContentItem;
  if (
    !item ||
    typeof item.id !== 'string' ||
    !/^[a-f0-9]{32}$/.test(item.id) ||
    typeof item.title !== 'string' ||
    typeof item.imageId !== 'string' ||
    (item.imageId !== '' && !/^[a-f0-9]{32}$/.test(item.imageId)) ||
    typeof item.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(item.createdAt)) ||
    typeof item.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(item.updatedAt)) ||
    !Number.isInteger(item.displaySeconds) ||
    !optionalTime(item.startsAt) ||
    !optionalTime(item.endsAt)
  )
    return false;
  return section === 'ads'
    ? 'active' in item &&
        item.imageId !== '' &&
        typeof item.active === 'boolean' &&
        Number.isInteger(item.sortOrder) &&
        item.sortOrder >= 0 &&
        item.sortOrder <= 10000
    : 'body' in item &&
        typeof item.body === 'string' &&
        typeof item.summary === 'string' &&
        typeof item.published === 'boolean' &&
        typeof item.showOnHome === 'boolean' &&
        Number.isInteger(item.sortOrder) &&
        (item.reviewStatus === undefined ||
          reviewStatuses.includes(item.reviewStatus)) &&
        (item.authorName === undefined || typeof item.authorName === 'string');
}

function optionalTime(value: unknown) {
  return (
    value === null ||
    (typeof value === 'string' && Number.isFinite(Date.parse(value)))
  );
}

const reviewStatuses: ReviewStatus[] = ['pending', 'approved', 'rejected'];
function path(section: ContentSection, id?: string) {
  return (
    '/v1/admin/content/' + section + (id ? '/' + encodeURIComponent(id) : '')
  );
}
export const contentRepository: ContentRepository = {
  async list(section, page) {
    const result = await request<ContentPage>(path(section) + '?page=' + page);
    if (
      !result ||
      !Array.isArray(result.items) ||
      result.items.length > 20 ||
      !result.items.every(item => valid(item, section)) ||
      result.page !== page ||
      result.pageSize !== 20 ||
      !Number.isSafeInteger(result.total) ||
      result.total < 0 ||
      result.totalPages !== Math.ceil(result.total / 20)
    )
      throw new ApiError(copy.form.unexpected);
    return result;
  },
  async listAll(section) {
    // Admin lists are small; the panel loads every page to sort, count and
    // preview the app's carousel.
    const items: ContentItem[] = [];
    for (let page = 1; page <= 50; page++) {
      const result = await contentRepository.list(section, page);
      items.push(...result.items);
      if (page >= result.totalPages) break;
    }
    return items;
  },
  async save(section, form, id) {
    const schedule = {
      displaySeconds: form.displaySeconds,
      startsAt: form.startsAt,
      endsAt: form.endsAt,
    };
    const body =
      section === 'ads'
        ? {
            title: form.title,
            imageId: form.imageId,
            active: form.active,
            sortOrder: form.sortOrder,
            ...schedule,
          }
        : {
            title: form.title,
            summary: form.summary,
            body: form.body,
            imageId: form.imageId,
            published: form.published,
            showOnHome: form.showOnHome,
            sortOrder: form.sortOrder,
            ...schedule,
          };
    const out = await request<{ advertisement?: unknown; article?: unknown }>(
      path(section, id),
      { method: id ? 'PUT' : 'POST', body },
    );
    if (
      !out ||
      !valid(section === 'ads' ? out.advertisement : out.article, section)
    )
      throw new ApiError(copy.form.unexpected);
  },
  async remove(section, id) {
    await request<void>(path(section, id), { method: 'DELETE' });
  },
  async review(id, decision: ReviewDecision) {
    const out = await request<{ article?: unknown }>(
      path('news', id) + '/review',
      { method: 'PUT', body: { decision } },
    );
    if (!out || !valid(out.article, 'news'))
      throw new ApiError(copy.form.unexpected);
  },
  async pendingReviews() {
    const out = await request<{ items?: unknown }>('/v1/admin/content/reviews');
    if (
      !out ||
      !Array.isArray(out.items) ||
      !out.items.every(item => valid(item, 'news'))
    )
      throw new ApiError(copy.form.unexpected);
    return out.items as Article[];
  },
  async upload(file) {
    const data = new FormData();
    data.append('image', file);
    const result = await request<{ imageId: string }>(
      '/v1/admin/content/images',
      { method: 'POST', body: data },
    );
    if (!result || !/^[a-f0-9]{32}$/.test(result.imageId))
      throw new ApiError(copy.form.unexpected);
    return result.imageId;
  },
  imageUrl(id) {
    return '/api/v1/admin/content/images/' + encodeURIComponent(id);
  },
};
