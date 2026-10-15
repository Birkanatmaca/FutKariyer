import { createStoreCheckout } from './application/store-checkout';
import { storeBilling } from './data/store-billing';
import { storeRepository } from './data/http-store-repository';

export { TeamRightsScreen } from './ui/TeamRightsScreen';
export { createStoreCheckout } from './application/store-checkout';
export type { StoreCheckout } from './application/store-checkout';
export type {
  StoreAvailability,
  StoreBuyOutcome,
  StoreProductIds,
} from './domain/store';
export { productIdFor, storeAvailable } from './domain/store';
export {
  validStoreProductIds,
  validStores,
} from './data/http-payments-repository';
export { useStoreRecovery } from './application/useStoreRecovery';
// Composed once for the app shell; screens receive it as a prop.
export const storeCheckout = createStoreCheckout(storeRepository, storeBilling);
