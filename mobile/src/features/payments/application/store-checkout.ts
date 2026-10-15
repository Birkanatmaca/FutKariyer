import type {
  StoreBilling,
  StoreBuyOutcome,
  StoreProduct,
  StoreRepository,
} from '../domain/store';

export class StoreUnavailableError extends Error {}

export function createStoreCheckout(
  repository: StoreRepository,
  billing: StoreBilling,
) {
  let recovering: Promise<void> | null = null;
  return {
    store: billing.store,
    prices: (productIds: string[]) =>
      productIds.length && billing.store
        ? billing.prices(productIds)
        : Promise.resolve({} as Record<string, string>),
    // Order → store sheet → server verification → finish. The store
    // transaction is finished only when the server says so, so a crash at any
    // step is retried by recover().
    async buy(
      token: string,
      product: StoreProduct,
      itemId: string,
    ): Promise<StoreBuyOutcome> {
      const store = billing.store;
      if (!store) throw new StoreUnavailableError();
      const order = await repository.createOrder(token, {
        store,
        product,
        itemId,
      });
      const purchase = await billing.purchase(order);
      if (!purchase) return 'cancelled';
      if (purchase === 'pending') return 'pending';
      const result = await repository.confirm(token, purchase);
      if (result.finish) await billing.finish(purchase);
      return result.status;
    },
    // Re-sends purchases the store still holds; one at a time per app run.
    recover(token: string) {
      if (!billing.store) return Promise.resolve();
      recovering ??= (async () => {
        try {
          for (const purchase of await billing.unfinished()) {
            try {
              const result = await repository.confirm(token, purchase);
              if (result.finish) await billing.finish(purchase);
            } catch {
              // Kept for the next attempt; the store keeps the transaction.
            }
          }
        } finally {
          recovering = null;
        }
      })();
      return recovering;
    },
  };
}
export type StoreCheckout = ReturnType<typeof createStoreCheckout>;
