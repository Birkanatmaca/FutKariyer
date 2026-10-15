import type { StoreAvailability, StoreProductIds } from './store';

export type TeamRequestPackage = StoreProductIds & {
  id: string;
  credits: 2 | 5 | 10;
  // Reporting value set by the admin; the store's own price is shown.
  amountMinor: number;
  currency: 'TRY';
  active: boolean;
  sortOrder: number;
};
export type PaymentCatalog = {
  items: TeamRequestPackage[];
  stores: StoreAvailability;
};
export interface PaymentsRepository {
  packages(token: string): Promise<PaymentCatalog>;
}
