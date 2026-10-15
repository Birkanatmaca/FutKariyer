import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  CheckoutOrder,
  PaymentCatalog,
  PaymentsRepository,
  TeamRequestPackage,
} from '../domain/models';

const validId = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
function validPackage(value: unknown): value is TeamRequestPackage {
  const item = value as TeamRequestPackage;
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
export const paymentsRepository: PaymentsRepository = {
  async packages(token) {
    const result = await request<{ items: unknown; checkoutEnabled: unknown }>(
      '/v1/payments/packages',
      { token },
    );
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(validPackage) ||
      typeof result.checkoutEnabled !== 'boolean'
    ) {
      throw new ApiError(copy.form.unexpected);
    }
    return result as PaymentCatalog;
  },
  async createOrder(token, packageId) {
    const result = await request<CheckoutOrder>(
      '/v1/me/team-request-payments',
      { method: 'POST', token, body: { packageId } },
    );
    if (
      !result ||
      typeof result.orderId !== 'string' ||
      !/^[a-f0-9]{32}$/.test(result.orderId) ||
      result.status !== 'pending' ||
      typeof result.provider !== 'string' ||
      typeof result.providerPaymentId !== 'string' ||
      typeof result.checkoutUrl !== 'string' ||
      !result.checkoutUrl.startsWith('https://')
    ) {
      throw new ApiError(copy.form.unexpected);
    }
    return result;
  },
};
