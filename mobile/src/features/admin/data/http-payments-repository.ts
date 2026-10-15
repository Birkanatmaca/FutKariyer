import type {
  AdminGateway,
  CatalogUpdate,
  Payment,
  PaymentPackage,
  PaymentPage,
  PaymentsRepository,
  ProPlan,
} from '../domain/models';
import {
  isCount,
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

const credits = [2, 5, 10];
const isAmount = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) > 0;
// Ids may be '' (not sold in that store); the server validates their format.
const hasStoreIds = (value: Record<string, unknown>) =>
  typeof value.appleProductId === 'string' &&
  typeof value.googleProductId === 'string';

export function isPaymentPackage(value: unknown): value is PaymentPackage {
  return (
    isRecord(value) &&
    isId(value.id) &&
    credits.includes(value.credits as number) &&
    isAmount(value.amountMinor) &&
    value.currency === 'TRY' &&
    typeof value.active === 'boolean' &&
    Number.isInteger(value.sortOrder) &&
    hasStoreIds(value)
  );
}
export function isPayment(value: unknown): value is Payment {
  return (
    isRecord(value) &&
    isId(value.id) &&
    (value.playerId === undefined || isId(value.playerId)) &&
    isText(value.playerName) &&
    isText(value.playerEmail) &&
    ((value.product === 'team_rights' &&
      credits.includes(value.packageCredits as number)) ||
      (value.product === 'pro' && value.packageCredits === 0)) &&
    isAmount(value.amountMinor) &&
    value.currency === 'TRY' &&
    isText(value.provider) &&
    isOneOf(value.status, ['pending', 'paid', 'failed', 'refunded']) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    (value.confirmedAt === undefined || isTimestamp(value.confirmedAt))
  );
}
export function isProPlan(value: unknown): value is ProPlan {
  return (
    isRecord(value) &&
    isId(value.id) &&
    Number.isSafeInteger(value.days) &&
    (value.days as number) > 0 &&
    isCount(value.bonusCredits) &&
    isAmount(value.amountMinor) &&
    value.currency === 'TRY' &&
    typeof value.active === 'boolean' &&
    hasStoreIds(value)
  );
}
export function isPaymentPage(
  value: unknown,
  page: number,
): value is PaymentPage {
  if (!isPage(value, isPayment, page, 20) || !isRecord(value)) return false;
  const summary = (value as Record<string, unknown>).summary;
  return (
    isRecord(summary) &&
    [
      summary.total,
      summary.pending,
      summary.paid,
      summary.failed,
      summary.refunded,
      summary.collectedMinor,
      summary.refundedMinor,
    ].every(isCount)
  );
}

const catalogBody = (update: CatalogUpdate) => ({
  amountMinor: update.amountMinor,
  active: update.active,
  appleProductId: update.appleProductId,
  googleProductId: update.googleProductId,
});

export function createPaymentsRepository(
  gateway: AdminGateway,
): PaymentsRepository {
  return {
    async packages() {
      const result = await gateway.request<unknown>(
        '/v1/admin/payments/packages',
      );
      if (!isRecord(result) || !isListOf(result.items, isPaymentPackage))
        unexpected();
      return result.items as PaymentPackage[];
    },
    async updatePackage(id, update) {
      const result = await gateway.request<unknown>(
        '/v1/admin/payments/packages/' + segment(id),
        { method: 'PUT', body: catalogBody(update) },
      );
      if (!isRecord(result) || !isPaymentPackage(result.package)) unexpected();
      return result.package as PaymentPackage;
    },
    async proPlan() {
      const result = await gateway.request<unknown>(
        '/v1/admin/payments/pro-plan',
      );
      if (!isRecord(result) || !isProPlan(result.plan)) unexpected();
      return result.plan as ProPlan;
    },
    async updateProPlan(id, update) {
      const result = await gateway.request<unknown>(
        '/v1/admin/payments/pro-plan/' + segment(id),
        { method: 'PUT', body: catalogBody(update) },
      );
      if (!isRecord(result) || !isProPlan(result.plan)) unexpected();
      return result.plan as ProPlan;
    },
    async list(status, page, search) {
      const result = await gateway.request<unknown>(
        '/v1/admin/payments?status=' +
          encodeURIComponent(status) +
          '&page=' +
          page +
          '&pageSize=20&search=' +
          encodeURIComponent(search),
      );
      if (!isPaymentPage(result, page)) unexpected();
      return result;
    },
  };
}
