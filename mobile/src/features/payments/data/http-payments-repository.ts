import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  PaymentCatalog,
  PaymentsRepository,
  TeamRequestPackage,
} from '../domain/models';
import type { StoreAvailability, StoreProductIds } from '../domain/store';

const validId = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const productId = (value: unknown) =>
  typeof value === 'string' && /^[A-Za-z0-9._]{0,100}$/.test(value);

export function validStoreProductIds(value: unknown): value is StoreProductIds {
  const ids = value as StoreProductIds;
  return (
    !!ids && productId(ids.appleProductId) && productId(ids.googleProductId)
  );
}
export function validStores(value: unknown): value is StoreAvailability {
  const stores = value as StoreAvailability;
  return (
    !!stores &&
    typeof stores.appStore === 'boolean' &&
    typeof stores.googlePlay === 'boolean'
  );
}
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
    Number.isInteger(item.sortOrder) &&
    validStoreProductIds(item)
  );
}
export const paymentsRepository: PaymentsRepository = {
  async packages(token) {
    const result = await request<{ items: unknown; stores: unknown }>(
      '/v1/payments/packages',
      { token },
    );
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(validPackage) ||
      !validStores(result.stores)
    ) {
      throw new ApiError(copy.form.unexpected);
    }
    return { items: result.items, stores: result.stores } as PaymentCatalog;
  },
};
