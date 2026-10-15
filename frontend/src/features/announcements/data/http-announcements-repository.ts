import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  Announcement,
  AnnouncementAudience,
  AnnouncementDraft,
  AnnouncementsRepository,
} from '../domain/models';

const audiences: AnnouncementAudience[] = [
  'all',
  'player',
  'club',
  'coach',
  'account',
];
const nonNegativeInt = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const validDate = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

function validAnnouncement(value: unknown): value is Announcement {
  const item = value as Announcement;
  return (
    !!item &&
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    item.kind === 'opportunity' &&
    typeof item.title === 'string' &&
    typeof item.body === 'string' &&
    audiences.includes(item.audience) &&
    typeof item.targetEmail === 'string' &&
    validDate(item.createdAt) &&
    nonNegativeInt(item.recipients)
  );
}

export const announcementsRepository: AnnouncementsRepository = {
  async list() {
    const result = await request<{ items: unknown }>('/v1/admin/announcements');
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(validAnnouncement)
    )
      throw new ApiError(copy.form.unexpected);
    return result.items;
  },
  async create(draft: AnnouncementDraft) {
    const result = await request<unknown>('/v1/admin/announcements', {
      method: 'POST',
      body: {
        title: draft.title,
        body: draft.body,
        audience: draft.audience,
        email: draft.audience === 'account' ? draft.email : '',
      },
    });
    if (!validAnnouncement(result)) throw new ApiError(copy.form.unexpected);
    return result;
  },
};
