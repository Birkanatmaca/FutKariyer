// In-app purchases. The store charges its own price; the server records the
// order first and grants rights or Pro only after verifying the store's
// signed record of the payment.
export type Store = 'app_store' | 'google_play';
export type StoreProduct = 'team_rights' | 'pro';
export type StoreAvailability = { appStore: boolean; googlePlay: boolean };
export type StoreProductIds = {
  appleProductId: string;
  googleProductId: string;
};
export type StoreOrder = {
  orderId: string;
  store: Store;
  productId: string;
  // Ties the store transaction to the order (Apple appAccountToken / Google
  // obfuscated account id).
  accountToken: string;
};
// A finished store sheet. native is the library object needed to finish it.
export type StorePurchase = {
  store: Store;
  productId: string;
  token: string;
  native: unknown;
};
export type StorePurchaseStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type StorePurchaseResult = {
  orderId: string;
  status: StorePurchaseStatus;
  finish: boolean;
};
export type StoreBuyOutcome = StorePurchaseStatus | 'cancelled';

export interface StoreBilling {
  // The store of this device; null where purchases are impossible (web preview).
  readonly store: Store | null;
  prices(productIds: string[]): Promise<Record<string, string>>;
  // Resolves null when the person closes the store sheet and 'pending' for a
  // deferred payment the store delivers later (e.g. parental approval).
  purchase(order: StoreOrder): Promise<StorePurchase | 'pending' | null>;
  finish(purchase: StorePurchase): Promise<void>;
  // Purchases the store still holds unfinished (e.g. after a crash).
  unfinished(): Promise<StorePurchase[]>;
}

export interface StoreRepository {
  createOrder(
    token: string,
    input: { store: Store; product: StoreProduct; itemId: string },
  ): Promise<StoreOrder>;
  confirm(token: string, purchase: StorePurchase): Promise<StorePurchaseResult>;
}

export function productIdFor(store: Store | null, ids: StoreProductIds) {
  if (store === 'app_store') return ids.appleProductId;
  if (store === 'google_play') return ids.googleProductId;
  return '';
}

export function storeAvailable(
  store: Store | null,
  availability: StoreAvailability,
) {
  return (
    (store === 'app_store' && availability.appStore) ||
    (store === 'google_play' && availability.googlePlay)
  );
}
