import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  Gift,
  GiftClaim,
  GiftInbox,
  GiftKind,
  GiftStatus,
  GiftsRepository,
} from '../domain/models';

const kinds: GiftKind[] = ['heart_one', 'heart_full', 'application_right'];
const statuses: GiftStatus[] = ['available', 'claimed', 'expired'];

const giftId = (v: unknown) =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const count = (v: unknown) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const date = (v: unknown) =>
  typeof v === 'string' && Number.isFinite(Date.parse(v));

function gift(v: unknown): v is Gift {
  const g = v as Gift;
  return (
    !!g &&
    giftId(g.id) &&
    kinds.includes(g.kind) &&
    typeof g.title === 'string' &&
    typeof g.message === 'string' &&
    statuses.includes(g.status) &&
    date(g.createdAt) &&
    date(g.expiresAt) &&
    (g.claimedAt === null || date(g.claimedAt))
  );
}

function inbox(v: unknown): GiftInbox {
  const body = v as GiftInbox;
  if (
    !body ||
    !Array.isArray(body.items) ||
    !body.items.every(gift) ||
    !count(body.availableCount) ||
    !date(body.serverTime)
  )
    throw new ApiError(copy.form.unexpected);
  return body;
}

const path = '/v1/gifts';

export const giftsRepository: GiftsRepository = {
  async list(token) {
    return inbox(await request<unknown>(path, { token }));
  },
  async claim(token, id) {
    const body = await request<unknown>(
      path + '/' + encodeURIComponent(id) + '/claim',
      { token, method: 'POST' },
    );
    const value = body as GiftClaim;
    if (!value || !['claimed', 'already_claimed'].includes(value.result))
      throw new ApiError(copy.form.unexpected);
    return { ...inbox(body), result: value.result };
  },
};
