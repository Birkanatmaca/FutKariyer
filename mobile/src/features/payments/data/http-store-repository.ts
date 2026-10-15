import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  StoreOrder,
  StorePurchaseResult,
  StoreRepository,
} from '../domain/store';

const orderId = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);

export function validStoreOrder(value: unknown): value is StoreOrder {
  const order = value as StoreOrder;
  return (
    !!order &&
    orderId(order.orderId) &&
    (order.store === 'app_store' || order.store === 'google_play') &&
    typeof order.productId === 'string' &&
    /^[A-Za-z0-9._]{1,100}$/.test(order.productId) &&
    typeof order.accountToken === 'string' &&
    order.accountToken.replace(/-/g, '') === order.orderId
  );
}

export function validPurchaseResult(
  value: unknown,
): value is StorePurchaseResult {
  const result = value as StorePurchaseResult;
  return (
    !!result &&
    orderId(result.orderId) &&
    ['pending', 'paid', 'failed', 'refunded'].includes(result.status) &&
    typeof result.finish === 'boolean'
  );
}

export const storeRepository: StoreRepository = {
  async createOrder(token, input) {
    const result = await request<unknown>('/v1/me/store-orders', {
      method: 'POST',
      token,
      body: input,
    });
    if (!validStoreOrder(result) || result.store !== input.store)
      throw new ApiError(copy.form.unexpected);
    return result;
  },
  async confirm(token, purchase) {
    const result = await request<unknown>('/v1/me/store-purchases', {
      method: 'POST',
      token,
      body: {
        store: purchase.store,
        productId: purchase.productId,
        token: purchase.token,
      },
    });
    if (!validPurchaseResult(result)) throw new ApiError(copy.form.unexpected);
    return result;
  },
};
