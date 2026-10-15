import { copy } from '../../../shared/lib/copy';
import type {
  AnnouncementDraft,
  AnnouncementsRepository,
} from '../domain/models';

export const announcementLimits = {
  titleMin: 2,
  titleMax: 120,
  bodyMax: 500,
  emailMax: 254,
} as const;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAnnouncementDraft(
  draft: AnnouncementDraft,
): AnnouncementDraft {
  return {
    title: draft.title.trim(),
    body: draft.body.trim(),
    audience: draft.audience,
    email: draft.audience === 'account' ? draft.email.trim() : '',
  };
}

export function validateAnnouncementDraft(
  draft: AnnouncementDraft,
): Record<string, string> {
  const fields: Record<string, string> = {};
  if (
    draft.title.length < announcementLimits.titleMin ||
    draft.title.length > announcementLimits.titleMax
  ) {
    fields.title = copy.announcements.errors.title;
  }
  if (draft.body.length < 1 || draft.body.length > announcementLimits.bodyMax) {
    fields.body = copy.announcements.errors.body;
  }
  if (draft.audience === 'account') {
    if (
      !emailPattern.test(draft.email) ||
      draft.email.length > announcementLimits.emailMax
    ) {
      fields.email = copy.announcements.errors.email;
    }
  }
  return fields;
}

export function createAnnouncementService(repository: AnnouncementsRepository) {
  return {
    list: () => repository.list(),
    create: (draft: AnnouncementDraft) =>
      repository.create(normalizeAnnouncementDraft(draft)),
  };
}
export type AnnouncementService = ReturnType<typeof createAnnouncementService>;
