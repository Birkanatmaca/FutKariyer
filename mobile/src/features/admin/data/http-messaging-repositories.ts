import type {
  AdminGateway,
  Announcement,
  AnnouncementsRepository,
  Gift,
  GiftCreated,
  GiftsRepository,
} from '../domain/models';
import {
  isCount,
  isListOf,
  isOneOf,
  isRecord,
  isText,
  isTimestamp,
  unexpected,
} from './validators';

// Gifts and announcements are both one-way campaigns: created once, listed,
// never edited or deleted.
const giftKinds = ['heart_one', 'heart_full', 'application_right'] as const;
const audiences = ['all', 'player', 'club', 'coach', 'account'] as const;
const isDays = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) >= 1;

export function isGift(value: unknown): value is Gift {
  return (
    isRecord(value) &&
    isText(value.id) &&
    value.id.length > 0 &&
    isOneOf(value.kind, giftKinds) &&
    isText(value.title) &&
    isText(value.message) &&
    isOneOf(value.audience, ['all', 'account']) &&
    (value.targetEmail === null || isText(value.targetEmail)) &&
    isDays(value.validityDays) &&
    isTimestamp(value.createdAt) &&
    isCount(value.recipients) &&
    isCount(value.claimed)
  );
}
function isGiftCreated(value: unknown): value is GiftCreated {
  return (
    isRecord(value) &&
    isText(value.id) &&
    value.id.length > 0 &&
    isOneOf(value.kind, giftKinds) &&
    isText(value.title) &&
    isCount(value.recipients) &&
    isDays(value.validityDays)
  );
}
export function isAnnouncement(value: unknown): value is Announcement {
  return (
    isRecord(value) &&
    isText(value.id) &&
    value.id.length > 0 &&
    value.kind === 'opportunity' &&
    isText(value.title) &&
    isText(value.body) &&
    isOneOf(value.audience, audiences) &&
    isText(value.targetEmail) &&
    isTimestamp(value.createdAt) &&
    isCount(value.recipients)
  );
}

export function createGiftsRepository(gateway: AdminGateway): GiftsRepository {
  return {
    async list() {
      const result = await gateway.request<unknown>('/v1/admin/gifts');
      if (!isRecord(result) || !isListOf(result.items, isGift)) unexpected();
      return result.items as Gift[];
    },
    async create(draft) {
      const result = await gateway.request<unknown>('/v1/admin/gifts', {
        method: 'POST',
        body: {
          kind: draft.kind,
          title: draft.title,
          message: draft.message,
          audience: draft.audience,
          email: draft.audience === 'account' ? draft.email : '',
          validityDays: draft.validityDays,
        },
      });
      if (!isGiftCreated(result)) unexpected();
      return result;
    },
  };
}

export function createAnnouncementsRepository(
  gateway: AdminGateway,
): AnnouncementsRepository {
  return {
    async list() {
      const result = await gateway.request<unknown>('/v1/admin/announcements');
      if (!isRecord(result) || !isListOf(result.items, isAnnouncement))
        unexpected();
      return result.items as Announcement[];
    },
    async create(draft) {
      const result = await gateway.request<unknown>('/v1/admin/announcements', {
        method: 'POST',
        body: {
          title: draft.title,
          body: draft.body,
          audience: draft.audience,
          email: draft.audience === 'account' ? draft.email : '',
        },
      });
      if (!isAnnouncement(result)) unexpected();
      return result;
    },
  };
}
