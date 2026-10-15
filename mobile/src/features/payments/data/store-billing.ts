import { Platform } from 'react-native';
import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
} from 'react-native-iap';
import type {
  Store,
  StoreBilling,
  StoreOrder,
  StorePurchase,
} from '../domain/store';

// StoreKit 2 / Google Play Billing through react-native-iap. Every product is
// finished as consumable so packages and 30-day Pro can be bought again.
const store: Store | null =
  Platform.OS === 'ios'
    ? 'app_store'
    : Platform.OS === 'android'
    ? 'google_play'
    : null;

let connection: Promise<unknown> | null = null;
function connect() {
  connection ??= initConnection().catch(error => {
    connection = null;
    throw error;
  });
  return connection;
}

function toPurchase(purchase: Purchase): StorePurchase | null {
  if (!store || !purchase.purchaseToken || purchase.purchaseState === 'pending')
    return null;
  return {
    store,
    productId: purchase.productId,
    token: purchase.purchaseToken,
    native: purchase,
  };
}

// The order a store purchase belongs to, from its account token.
function orderOf(purchase: Purchase) {
  const token =
    'appAccountToken' in purchase
      ? purchase.appAccountToken
      : 'obfuscatedAccountIdAndroid' in purchase
      ? purchase.obfuscatedAccountIdAndroid
      : null;
  return (token ?? '').replace(/-/g, '').toLowerCase();
}

export const storeBilling: StoreBilling = {
  store,
  async prices(productIds) {
    await connect();
    const products = await fetchProducts({ skus: productIds, type: 'in-app' });
    const out: Record<string, string> = {};
    for (const product of products ?? [])
      out[product.id] = product.displayPrice;
    return out;
  },
  async purchase(order: StoreOrder) {
    await connect();
    return new Promise<StorePurchase | 'pending' | null>((resolve, reject) => {
      const done = () => {
        updated.remove();
        failed.remove();
      };
      const updated = purchaseUpdatedListener(purchase => {
        if (orderOf(purchase) !== order.orderId) return;
        if (purchase.purchaseState === 'pending') {
          // Deferred payment: the store delivers it again once settled.
          done();
          resolve('pending');
          return;
        }
        const result = toPurchase(purchase);
        if (!result) return;
        done();
        resolve(result);
      });
      const failed = purchaseErrorListener(error => {
        done();
        if (error.code === ErrorCode.UserCancelled) resolve(null);
        else reject(new Error(error.message));
      });
      requestPurchase({
        type: 'in-app',
        request: {
          apple: { sku: order.productId, appAccountToken: order.accountToken },
          google: {
            skus: [order.productId],
            obfuscatedAccountId: order.orderId,
          },
        },
      }).catch(error => {
        done();
        reject(error);
      });
    });
  },
  async finish(purchase) {
    await finishTransaction({
      purchase: purchase.native as Purchase,
      isConsumable: true,
    });
  },
  async unfinished() {
    await connect();
    const purchases = await getAvailablePurchases();
    return purchases
      .map(toPurchase)
      .filter((item): item is StorePurchase => !!item);
  },
};
