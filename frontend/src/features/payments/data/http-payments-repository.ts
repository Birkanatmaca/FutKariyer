import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  Payment,
  PaymentPackage,
  PaymentPage,
  PaymentStatus,
  PaymentsRepository,
  ProPlan,
} from '../domain/models';

const validId = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
function validPackage(value: unknown): value is PaymentPackage {
  const item = value as PaymentPackage;
  return (
    !!item &&
    validId(item.id) &&
    [2, 5, 10].includes(item.credits) &&
    Number.isSafeInteger(item.amountMinor) &&
    item.amountMinor > 0 &&
    item.currency === 'TRY' &&
    typeof item.active === 'boolean' &&
    Number.isInteger(item.sortOrder)
  );
}
function validProPlan(value: unknown): value is ProPlan {
  const item = value as ProPlan;
  return (
    !!item &&
    validId(item.id) &&
    Number.isInteger(item.days) &&
    item.days > 0 &&
    Number.isInteger(item.bonusCredits) &&
    item.bonusCredits >= 0 &&
    Number.isSafeInteger(item.amountMinor) &&
    item.amountMinor > 0 &&
    item.currency === 'TRY' &&
    typeof item.active === 'boolean'
  );
}
function validProduct(item: Payment) {
  return item.product === 'pro'
    ? item.packageCredits === 0
    : item.product === 'team_rights' &&
        [2, 5, 10].includes(item.packageCredits);
}
function validPayment(value: unknown): value is Payment {
  const item = value as Payment;
  return (
    !!item &&
    validId(item.id) &&
    (item.playerId === undefined || validId(item.playerId)) &&
    typeof item.playerName === 'string' &&
    typeof item.playerEmail === 'string' &&
    validProduct(item) &&
    Number.isSafeInteger(item.amountMinor) &&
    item.amountMinor > 0 &&
    item.currency === 'TRY' &&
    typeof item.provider === 'string' &&
    ['pending', 'paid', 'failed', 'refunded'].includes(item.status) &&
    typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    typeof item.updatedAt === 'string' &&
    Number.isFinite(Date.parse(item.updatedAt)) &&
    (item.confirmedAt === undefined ||
      (typeof item.confirmedAt === 'string' &&
        Number.isFinite(Date.parse(item.confirmedAt))))
  );
}
export const paymentsRepository: PaymentsRepository = {
  async packages() {
    const result = await request<{ items: unknown }>(
      '/v1/admin/payments/packages',
    );
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(validPackage)
    )
      throw new ApiError(copy.form.unexpected);
    return result.items;
  },
  async updatePackage(id, amountMinor, active) {
    const result = await request<{ package: unknown }>(
      '/v1/admin/payments/packages/' + encodeURIComponent(id),
      { method: 'PUT', body: { amountMinor, active } },
    );
    if (!validPackage(result.package)) throw new ApiError(copy.form.unexpected);
    return result.package;
  },
  async proPlan() {
    const result = await request<{ plan: unknown }>(
      '/v1/admin/payments/pro-plan',
    );
    if (!result || !validProPlan(result.plan))
      throw new ApiError(copy.form.unexpected);
    return result.plan;
  },
  async updateProPlan(id, amountMinor, active) {
    const result = await request<{ plan: unknown }>(
      '/v1/admin/payments/pro-plan/' + encodeURIComponent(id),
      { method: 'PUT', body: { amountMinor, active } },
    );
    if (!result || !validProPlan(result.plan))
      throw new ApiError(copy.form.unexpected);
    return result.plan;
  },
  async list(status: PaymentStatus | 'all', page, search) {
    const result = await request<PaymentPage>(
      '/v1/admin/payments?status=' +
        encodeURIComponent(status) +
        '&page=' +
        page +
        '&pageSize=20&search=' +
        encodeURIComponent(search),
    );
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(validPayment) ||
      result.page !== page ||
      result.pageSize !== 20 ||
      !Number.isSafeInteger(result.total) ||
      result.total < 0 ||
      result.totalPages !== Math.ceil(result.total / 20) ||
      !result.summary ||
      ![
        result.summary.total,
        result.summary.pending,
        result.summary.paid,
        result.summary.failed,
        result.summary.refunded,
        result.summary.collectedMinor,
        result.summary.refundedMinor,
      ].every(value => Number.isSafeInteger(value) && value >= 0)
    )
      throw new ApiError(copy.form.unexpected);
    return result;
  },
};
