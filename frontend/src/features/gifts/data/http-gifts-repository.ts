import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  Gift,
  GiftCreated,
  GiftDraft,
  GiftKind,
  GiftsRepository,
} from '../domain/models';

const kinds: GiftKind[] = ['heart_one', 'heart_full', 'application_right'];
const nonNegativeInt = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const validDays = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) >= 1;
const validDate = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

function validGift(value: unknown): value is Gift {
  const item = value as Gift;
  return (
    !!item &&
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    kinds.includes(item.kind) &&
    typeof item.title === 'string' &&
    typeof item.message === 'string' &&
    (item.audience === 'all' || item.audience === 'account') &&
    (item.targetEmail === null || typeof item.targetEmail === 'string') &&
    validDays(item.validityDays) &&
    validDate(item.createdAt) &&
    nonNegativeInt(item.recipients) &&
    nonNegativeInt(item.claimed)
  );
}

function validCreated(value: unknown): value is GiftCreated {
  const item = value as GiftCreated;
  return (
    !!item &&
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    kinds.includes(item.kind) &&
    typeof item.title === 'string' &&
    nonNegativeInt(item.recipients) &&
    validDays(item.validityDays)
  );
}

export const giftsRepository: GiftsRepository = {
  async list() {
    const result = await request<{ items: unknown }>('/v1/admin/gifts');
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(validGift)
    )
      throw new ApiError(copy.form.unexpected);
    return result.items;
  },
  async create(draft: GiftDraft) {
    const result = await request<unknown>('/v1/admin/gifts', {
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
    if (!validCreated(result)) throw new ApiError(copy.form.unexpected);
    return result;
  },
};
