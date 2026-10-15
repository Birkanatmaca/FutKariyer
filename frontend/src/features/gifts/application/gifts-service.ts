import { copy } from '../../../shared/lib/copy';
import type { GiftDraft, GiftsRepository } from '../domain/models';

export const giftLimits = {
  titleMin: 2,
  titleMax: 80,
  messageMax: 500,
  validityMin: 1,
  validityMax: 365,
  emailMax: 254,
} as const;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeGiftDraft(draft: GiftDraft): GiftDraft {
  return {
    kind: draft.kind,
    title: draft.title.trim(),
    message: draft.message.trim(),
    audience: draft.audience,
    email: draft.audience === 'account' ? draft.email.trim() : '',
    validityDays: draft.validityDays,
  };
}

export function validateGiftDraft(draft: GiftDraft): Record<string, string> {
  const fields: Record<string, string> = {};
  if (
    draft.title.length < giftLimits.titleMin ||
    draft.title.length > giftLimits.titleMax
  ) {
    fields.title = copy.gifts.errors.title;
  }
  if (draft.message.length > giftLimits.messageMax) {
    fields.message = copy.gifts.errors.message;
  }
  if (draft.audience === 'account') {
    if (
      !emailPattern.test(draft.email) ||
      draft.email.length > giftLimits.emailMax
    ) {
      fields.email = copy.gifts.errors.email;
    }
  }
  if (
    !Number.isInteger(draft.validityDays) ||
    draft.validityDays < giftLimits.validityMin ||
    draft.validityDays > giftLimits.validityMax
  ) {
    fields.validityDays = copy.gifts.errors.validityDays;
  }
  return fields;
}

export function createGiftService(repository: GiftsRepository) {
  return {
    list: () => repository.list(),
    create: (draft: GiftDraft) => repository.create(normalizeGiftDraft(draft)),
  };
}
export type GiftService = ReturnType<typeof createGiftService>;
