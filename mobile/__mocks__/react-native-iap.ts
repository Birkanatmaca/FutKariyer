// Jest stand-in for the native store module; tests inject their own billing.
export const ErrorCode = { UserCancelled: 'user-cancelled' };
export const initConnection = jest.fn(async () => true);
export const fetchProducts = jest.fn(async () => []);
export const requestPurchase = jest.fn(async () => null);
export const finishTransaction = jest.fn(async () => undefined);
export const getAvailablePurchases = jest.fn(async () => []);
export const purchaseUpdatedListener = jest.fn(() => ({ remove: jest.fn() }));
export const purchaseErrorListener = jest.fn(() => ({ remove: jest.fn() }));
