import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  ProCheckout,
  ProfileVisitors,
  ProOffer,
  ProRepository,
  ProState,
  ProStatus,
  RoleCounts,
  VisitorIdentity,
  VisitorRow,
  VisitorTotals,
} from '../domain/models';

const idValid = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const dateValid = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const countValid = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const roles = ['player', 'club', 'coach', 'organizer'];
const footballTypes = ['unknown', 'amateur', 'professional', 'halisaha'];

export function validProStatus(value: unknown): value is ProStatus {
  const status = value as ProStatus;
  return (
    !!status &&
    typeof status.active === 'boolean' &&
    (status.expiresAt === null || dateValid(status.expiresAt)) &&
    typeof status.privateBrowsing === 'boolean' &&
    countValid(status.bonusCredits) &&
    // Private browsing is a Pro-only setting.
    (status.active || !status.privateBrowsing)
  );
}

export function validProOffer(value: unknown): value is ProOffer {
  const offer = value as ProOffer;
  const plan = offer?.plan;
  return (
    !!offer &&
    typeof offer.checkoutEnabled === 'boolean' &&
    !!plan &&
    idValid(plan.id) &&
    Number.isSafeInteger(plan.days) &&
    plan.days > 0 &&
    countValid(plan.bonusCredits) &&
    Number.isSafeInteger(plan.amountMinor) &&
    plan.amountMinor > 0 &&
    plan.currency === 'TRY' &&
    typeof plan.active === 'boolean'
  );
}

function validCounts(value: unknown): value is RoleCounts {
  const counts = value as RoleCounts;
  return (
    !!counts &&
    [...roles, 'hidden'].every(role =>
      countValid(counts[role as keyof RoleCounts]),
    )
  );
}
function validTotals(value: unknown): value is VisitorTotals {
  const totals = value as VisitorTotals;
  return (
    !!totals &&
    countValid(totals.visitors) &&
    countValid(totals.visits) &&
    validCounts(totals.byRole)
  );
}
function validIdentity(value: unknown): value is VisitorIdentity {
  const visitor = value as VisitorIdentity;
  return (
    !!visitor &&
    idValid(visitor.id) &&
    typeof visitor.fullName === 'string' &&
    visitor.fullName.length > 0 &&
    roles.includes(visitor.role) &&
    typeof visitor.verified === 'boolean' &&
    typeof visitor.isPro === 'boolean' &&
    typeof visitor.club === 'string' &&
    typeof visitor.district === 'string' &&
    footballTypes.includes(visitor.footballType) &&
    typeof visitor.canOpen === 'boolean' &&
    typeof visitor.private === 'boolean'
  );
}
// Anonymous rows must not carry any identity; such a payload is rejected.
const identityKeys = ['visitor', 'id', 'fullName', 'visitCount'];
export function validVisitorRow(value: unknown): value is VisitorRow {
  const row = value as VisitorRow & Record<string, unknown>;
  if (!row || typeof row.key !== 'string' || !dateValid(row.lastVisitedAt))
    return false;
  if (row.kind === 'visitor')
    return (
      countValid(row.visitCount) &&
      row.visitCount > 0 &&
      validIdentity(row.visitor) &&
      row.key === row.visitor.id
    );
  if (identityKeys.some(key => key in row)) return false;
  if (row.kind === 'private') return !('role' in row) && !('district' in row);
  return (
    row.kind === 'obscured' &&
    roles.includes(row.role) &&
    (row.district === undefined || typeof row.district === 'string')
  );
}
export function validVisitors(value: unknown): value is ProfileVisitors {
  const out = value as ProfileVisitors;
  return (
    !!out &&
    typeof out.isPro === 'boolean' &&
    countValid(out.windowDays) &&
    !!out.summary &&
    validTotals(out.summary.window) &&
    validTotals(out.summary.week) &&
    Array.isArray(out.items) &&
    out.items.every(validVisitorRow) &&
    // A free owner sees at most one identity; a Pro owner sees only identities.
    (out.isPro
      ? out.items.every(row => row.kind === 'visitor')
      : out.items.filter(row => row.kind === 'visitor').length <= 1)
  );
}

function checked<T>(value: unknown, valid: (value: unknown) => value is T): T {
  if (!valid(value)) throw new ApiError(copy.form.unexpected);
  return value;
}

export const proRepository: ProRepository = {
  async status(token) {
    const result = await request<ProState>('/v1/me/pro', { token });
    if (!result || typeof result.eligible !== 'boolean')
      throw new ApiError(copy.form.unexpected);
    return {
      pro: checked(result.pro, validProStatus),
      eligible: result.eligible,
    };
  },
  async setPrivateBrowsing(token, on) {
    const result = await request<{ pro: unknown }>('/v1/me/pro/settings', {
      method: 'PUT',
      token,
      body: { privateBrowsing: on },
    });
    return checked(result?.pro, validProStatus);
  },
  async offer(token) {
    return checked(
      await request<unknown>('/v1/payments/pro-plan', { token }),
      validProOffer,
    );
  },
  async checkout(token, planId) {
    const result = await request<ProCheckout>('/v1/me/pro-payments', {
      method: 'POST',
      token,
      body: { planId },
    });
    if (
      !result ||
      !idValid(result.orderId) ||
      result.status !== 'pending' ||
      typeof result.provider !== 'string' ||
      typeof result.providerPaymentId !== 'string' ||
      typeof result.checkoutUrl !== 'string' ||
      !result.checkoutUrl.startsWith('https://')
    )
      throw new ApiError(copy.form.unexpected);
    return result;
  },
  async visitors(token) {
    return checked(
      await request<unknown>('/v1/me/profile-visitors', { token }),
      validVisitors,
    );
  },
};
